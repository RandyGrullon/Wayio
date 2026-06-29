import * as Sentry from '@sentry/nextjs'
import { aiClient } from '@/lib/ai/client'
import type { TripForm } from '@/lib/validations/tripForm'
import {
  buildItineraryPrompt,
  type ItineraryContext,
} from '@/lib/ai/generateItinerary'
import { extractJson } from '@/lib/ai/extractJson'
import { getWeatherByCity } from '@/lib/api/openweather'
import type { WeatherData } from '@/lib/api/openweather'
import { getTravelTimes } from '@/lib/api/googlemaps'
import { geocode } from '@/lib/api/geocode'
import { buildViatorLink } from '@/constants/affiliateLinks'
import { getCachedTrip, saveCachedTrip } from '@/lib/cache/tripCache'
import { buildDemoTrips } from '@/lib/demo/mockTrip'
import { aiConfigured } from '@/lib/ai/config'
import type { Trip, Day } from '@/types/trip'
import type { Activity } from '@/types/activity'

export interface GenerateResult {
  basico: Trip
  confort: Trip
  premium: Trip
  weather: WeatherData | null
  demo?: boolean
  /** Motivo legible cuando se cae a demo (p. ej. límite de tokens). */
  motivo?: string
}

/** Fase de progreso reportada al cliente durante el streaming. */
export interface ProgressEvent {
  fase: 'cache' | 'demo' | 'contexto' | 'ia' | 'coords' | 'listo' | 'error'
  label: string
}

export type ProgressFn = (p: ProgressEvent) => void

export interface GenerateOptions {
  noCache?: boolean
  onProgress?: ProgressFn
}

export interface GenerateOutcome {
  result: GenerateResult
  cacheHit: boolean
  /** demo "puro" (sin IA) vs. fallback tras error de IA se distingue por motivo. */
  demo: boolean
}

/** Resultado de demostración (sin IA) para previsualizar la app. */
function demoResult(form: TripForm): GenerateResult {
  return { ...buildDemoTrips(form), demo: true }
}

/** Traduce un error de generación a un mensaje claro para el usuario. */
function describeFailure(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/429|rate.?limit|tokens per day|TPD/i.test(msg)) {
    return 'Se alcanzó el límite diario de tokens del proveedor de IA. Mostramos un ejemplo mientras tanto; vuelve a intentarlo más tarde o configura otra API key.'
  }
  if (/401|403|invalid|api.?key|unauthorized/i.test(msg)) {
    return 'La API key de IA no es válida. Revisa tu configuración en .env.local.'
  }
  return 'La IA no pudo generar el itinerario en este momento. Mostramos un ejemplo de muestra.'
}

async function buscarClima(form: TripForm): Promise<WeatherData | null> {
  try {
    return await getWeatherByCity(form.destino)
  } catch {
    return null
  }
}

async function enrichDayWithTravelTimes(day: Day): Promise<Day> {
  if (day.actividades.length < 2) return day
  try {
    const times = await getTravelTimes(day.actividades)
    const enriched: Activity[] = day.actividades.map((act, i) => ({
      ...act,
      tiempoHastaSiguiente: times[i] ?? act.tiempoHastaSiguiente,
    }))
    return { ...day, actividades: enriched }
  } catch {
    return day
  }
}

type PartialTrip = Omit<
  Trip,
  | 'id'
  | 'origen'
  | 'personas'
  | 'fechaInicio'
  | 'fechaFin'
  | 'paquete'
  | 'listaActividades'
  | 'actividadesPendientes'
>

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms))

/**
 * Corrige las coordenadas de las actividades principales geocodificándolas con
 * OpenStreetMap (gratis). Nominatim limita a ~1 req/s, así que solo afinamos
 * hasta `max` lugares reales (saltando traslados) y los hacemos en serie. El
 * resto se geocodifica en background desde el cliente (useBackgroundGeocode).
 * Muta el trip en sitio: las coords del modelo son aproximadas; estas son reales.
 */
async function geocodeKeyActivities(trip: Trip, max = 6): Promise<void> {
  const candidatas = trip.dias
    .flatMap((d) => d.actividades.map((a) => ({ act: a, ciudad: d.ciudad })))
    .filter(({ act }) => act.tipo !== 'traslado' && act.nombre)
    .slice(0, max)

  for (const { act, ciudad } of candidatas) {
    const punto = await geocode(`${act.nombre}, ${ciudad}`)
    if (punto) {
      act.lat = punto.lat
      act.lng = punto.lng
    }
    await sleep(1100) // respeta el rate-limit de Nominatim
  }
}

async function generatePackage(
  form: TripForm,
  paquete: 'basico' | 'confort' | 'premium',
  context: ItineraryContext
): Promise<Trip> {
  const formWithPaquete: TripForm = { ...form, paquete }
  const prompt = buildItineraryPrompt(formWithPaquete, context)

  const message = await aiClient.messages.create({
    model: process.env.AI_ITINERARY_MODEL ?? 'claude-sonnet-4-6',
    // Un itinerario de pocos días cabe holgado en 4096 tokens; bajarlo de 8000
    // reduce el consumo diario ~2x (clave en planes gratuitos de Groq).
    max_tokens: Number(process.env.AI_ITINERARY_MAX_TOKENS) || 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const text =
    (
      message.content.find((b) => b.type === 'text') as
        | { type: 'text'; text: string }
        | undefined
    )?.text ?? ''

  const partial = extractJson<PartialTrip>(text)

  if (!Array.isArray(partial.dias) || partial.dias.length === 0) {
    throw new Error('La IA no devolvió días válidos')
  }

  // Enrich each day's activities with real Google Maps travel times in parallel
  const enrichedDias = await Promise.all(
    partial.dias.map(enrichDayWithTravelTimes)
  )

  // Adjuntar enlace de afiliado (reserva de actividades) a cada lugar de pago.
  const diasConLinks = enrichedDias.map((dia) => ({
    ...dia,
    actividades: dia.actividades.map((act) =>
      act.tipo !== 'traslado' && !act.linkAfiliado
        ? { ...act, linkAfiliado: buildViatorLink(act.nombre, dia.ciudad) }
        : act
    ),
  }))

  return {
    ...partial,
    dias: diasConLinks,
    id: crypto.randomUUID(),
    origen: form.origen,
    personas: form.personas,
    fechaInicio: form.fechaInicio,
    fechaFin: form.fechaFin,
    paquete,
    listaActividades: [],
    actividadesPendientes: [],
  }
}

type Tier = 'basico' | 'confort' | 'premium'

/**
 * Variante por tier que la IA adjunta a cada actividad sustituible en la MISMA
 * generación. Permite que cada paquete tenga hoteles/restaurantes/experiencias
 * genuinamente distintos (no solo precio escalado). Es opcional: si falta (modelo
 * pequeño, demo o caché antigua) caemos al escalado de precio de siempre.
 */
interface TierVariant {
  nombre?: string
  descripcion?: string
  tipo?: Activity['tipo']
  precioEstimado?: number
  reservaRequerida?: boolean
}

/** Actividad tal como llega de la IA: igual que Activity + variantes opcionales. */
type ActivityWithVariants = Activity & {
  variantesTier?: Partial<Record<'basico' | 'premium', TierVariant>>
}

/** Quita el campo transitorio variantesTier antes de exponer la actividad. */
function stripVariants(act: ActivityWithVariants): Activity {
  if (!act.variantesTier) return act
  const { variantesTier: _omit, ...rest } = act
  void _omit
  return rest
}

/** Aplica (si existe) la variante del tier a una actividad y la limpia. */
function applyVariant(
  act: ActivityWithVariants,
  target: Tier,
  ratio: number
): Activity {
  const variant = target === 'confort' ? undefined : act.variantesTier?.[target]
  const base = stripVariants(act)
  if (act.tipo === 'traslado' || !variant) {
    // Sin variante real → comportamiento clásico: escalar solo el precio.
    return { ...base, precioEstimado: Math.round(base.precioEstimado * ratio) }
  }
  // El link de afiliado cambia con el lugar: se quita aquí y deriveTier lo
  // recalcula a partir del nuevo nombre.
  const { linkAfiliado: _drop, ...sinLink } = base
  void _drop
  return {
    ...sinLink,
    nombre: variant.nombre ?? base.nombre,
    descripcion: variant.descripcion ?? base.descripcion,
    tipo: variant.tipo ?? base.tipo,
    reservaRequerida: variant.reservaRequerida ?? base.reservaRequerida,
    precioEstimado:
      typeof variant.precioEstimado === 'number'
        ? Math.round(variant.precioEstimado)
        : Math.round(base.precioEstimado * ratio),
  }
}

// Multiplicador de gasto relativo de cada tier. Se usa como fallback para
// derivar los tiers cuando la IA no devolvió variantes reales (modelo pequeño,
// demo o caché antigua), escalando el presupuesto del tier base.
const TIER_FACTOR: Record<Tier, number> = {
  basico: 0.65,
  confort: 1,
  premium: 1.9,
}

const TIER_NOTA: Record<Tier, string> = {
  basico:
    'Versión económica: alojamiento sencillo y actividades de bajo costo.',
  confort: 'Versión equilibrada: buen confort y mezcla de experiencias.',
  premium: 'Versión premium: alojamiento de lujo y experiencias exclusivas.',
}

/**
 * Deriva un tier a partir del tier CONFORT generado por la IA. Si la IA adjuntó
 * variantesTier (hoteles/actividades reales por nivel), las aplica para que cada
 * paquete difiera en el TIPO de experiencia, no solo en precio. Cuando no hay
 * variantes, cae al escalado de precio clásico. En ambos casos evita una segunda
 * llamada de IA (clave en planes gratuitos con límite por minuto).
 *
 * `base` debe ser el trip CONFORT (las variantes están relativas a ese nivel).
 */
function deriveTier(base: Trip, target: Tier): Trip {
  const ratio = TIER_FACTOR[target] / TIER_FACTOR.confort
  const round = (n: number): number => Math.round(n)

  const dias = base.dias.map((d) => {
    let dayHasVariant = false
    const actividades = (d.actividades as ActivityWithVariants[]).map((a) => {
      const before = a.nombre
      const swapped = applyVariant(a, target, ratio)
      if (swapped.nombre !== before) dayHasVariant = true
      // Reasignar link de afiliado si la actividad cambió de lugar.
      return swapped.tipo !== 'traslado' && !swapped.linkAfiliado
        ? {
            ...swapped,
            linkAfiliado: buildViatorLink(swapped.nombre, d.ciudad),
          }
        : swapped
    })
    // Si el día tuvo swaps reales, recomputar su presupuesto desde los precios
    // reales de las variantes; si no, escalar como antes.
    const presupuestoDia = dayHasVariant
      ? actividades.reduce((s, x) => s + (x.precioEstimado || 0), 0)
      : round(d.presupuestoDia * ratio)
    return { ...d, presupuestoDia, actividades }
  })

  // El total siempre es la suma de los días: coherente con o sin variantes.
  const presupuestoTotal = dias.reduce((s, d) => s + d.presupuestoDia, 0)
  const personas = base.personas || 1

  return {
    ...base,
    id: crypto.randomUUID(),
    paquete: target,
    presupuestoTotal,
    presupuestoPorPersona: round(presupuestoTotal / personas),
    resumenViaje: `${TIER_NOTA[target]} ${base.resumenViaje}`,
    dias,
  }
}

/** Escala todos los importes de un trip por `factor` (sube o baja). */
function scaleTripMoney(trip: Trip, factor: number): Trip {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return trip
  const r = (n: number): number => Math.round(n)
  return {
    ...trip,
    presupuestoTotal: r(trip.presupuestoTotal * factor),
    presupuestoPorPersona: r(trip.presupuestoPorPersona * factor),
    dias: trip.dias.map((d) => ({
      ...d,
      presupuestoDia: r(d.presupuestoDia * factor),
      actividades: d.actividades.map((a) => ({
        ...a,
        precioEstimado: r(a.precioEstimado * factor),
      })),
    })),
  }
}

/**
 * Garantiza que el precio crezca con el tier: básico ≤ confort ≤ premium.
 * Las variantesTier de la IA pueden no ser monótonas (un premium con precios
 * más bajos que el confort), lo que confunde al usuario. Mantenemos CONFORT como
 * ancla (es el plan real de la IA) y reescalamos básico/premium solo si quedaron
 * fuera de orden.
 */
function enforceTierOrder(t: Record<Tier, Trip>): Record<Tier, Trip> {
  let { basico, premium } = t
  const { confort } = t
  const cTotal = confort.presupuestoTotal
  if (cTotal > 0) {
    if (basico.presupuestoTotal >= cTotal) {
      basico = scaleTripMoney(basico, (cTotal * 0.8) / basico.presupuestoTotal)
    }
    if (premium.presupuestoTotal <= cTotal * 1.2) {
      premium = scaleTripMoney(
        premium,
        (cTotal * 1.35) / premium.presupuestoTotal
      )
    }
  }
  return { basico, confort, premium }
}

/**
 * Orquesta la generación completa de los 3 paquetes (con caché, clima,
 * geocoding y fallback a demo). `onProgress` permite emitir hitos reales al
 * cliente vía SSE; sin él, funciona igual que la versión no-streaming.
 */
export async function generateTrips(
  form: TripForm,
  opts: GenerateOptions = {}
): Promise<GenerateOutcome> {
  const { noCache = false, onProgress } = opts
  const emit = (fase: ProgressEvent['fase'], label: string): void =>
    onProgress?.({ fase, label })

  if (!noCache) {
    const cached = await getCachedTrip(form)
    if (cached) {
      emit('cache', 'Recuperando un plan que ya teníamos listo')
      return {
        result: JSON.parse(cached) as GenerateResult,
        cacheHit: true,
        demo: false,
      }
    }
  }

  // Sin IA configurada → datos de demostración (ver la app sin API keys)
  if (!aiConfigured()) {
    emit('demo', 'Mostrando un ejemplo (sin API key de IA configurada)')
    return { result: demoResult(form), cacheHit: false, demo: true }
  }

  // Búsqueda real previa: clima (OpenWeather) + geocodificación del destino
  // (OpenStreetMap, sin key). Se la pasamos a la IA para anclar el itinerario.
  emit('contexto', 'Buscando clima y ubicación del destino')
  const destinoParaGeo = form.destinoSorpresa ? '' : form.destino
  const [weather, anchor] = await Promise.all([
    buscarClima(form),
    destinoParaGeo ? geocode(destinoParaGeo) : Promise.resolve(null),
  ])

  const context: ItineraryContext = {
    anchor,
    clima: weather
      ? { temp: weather.temp, description: weather.description }
      : null,
  }

  try {
    emit('ia', 'La IA está armando las 3 versiones de tu viaje')
    // Generamos siempre el nivel CONFORT como base: la IA adjunta variantesTier
    // (básico/premium) ancladas a ese punto medio, y de ahí derivamos los 3.
    const base = await generatePackage(
      { ...form, paquete: 'confort' },
      'confort',
      context
    )
    // Afinar coordenadas reales de los lugares clave antes de derivar tiers.
    emit('coords', 'Afinando las coordenadas reales de los lugares')
    await geocodeKeyActivities(base)
    const rawTiers = (['basico', 'confort', 'premium'] as const).reduce(
      (acc, t) => {
        acc[t] = deriveTier(base, t)
        return acc
      },
      {} as Record<Tier, Trip>
    )
    const tiers = enforceTierOrder(rawTiers)
    const result: GenerateResult = { ...tiers, weather }
    await saveCachedTrip(form, JSON.stringify(result))
    emit('listo', '¡Tu viaje está listo!')
    return { result, cacheHit: false, demo: false }
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'generate-itinerary' } })
    emit('demo', 'No se pudo generar; mostramos un ejemplo')
    return {
      result: { ...demoResult(form), weather, motivo: describeFailure(err) },
      cacheHit: false,
      demo: true,
    }
  }
}
