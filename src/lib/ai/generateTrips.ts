import * as Sentry from '@sentry/nextjs'
import type { z } from 'zod'
import { aiGenerate, describeAiError, type AiErrorCode } from '@/lib/ai/client'
import { aiConfigured } from '@/lib/ai/config'
import { extractJson } from '@/lib/ai/extractJson'
import {
  buildBloquePrompt,
  buildEsqueletoPrompt,
  buildViajeCompletoPrompt,
  DIAS_POR_BLOQUE,
  SYSTEM_PROMPT,
  UMBRAL_UNA_LLAMADA,
  type ItineraryContext,
} from '@/lib/ai/generateItinerary'
import {
  BloqueDiasSchema,
  EsqueletoSchema,
  ViajeCompletoSchema,
  jsonSchemaOf,
  type DiaIA,
  type EsqueletoIA,
} from '@/lib/ai/itinerarySchemas'
import {
  descartarCoordsLejanas,
  haversineKm,
  normalizeDay,
  num,
  str,
  TIPOS_ACTIVIDAD,
} from '@/lib/ai/normalize'
import { ajustarTiemposTraslado } from '@/lib/ai/travelTimes'
import { geocode, type GeoPoint } from '@/lib/api/geocode'
import { getTripWeather, type WeatherData } from '@/lib/api/openweather'
import { getCachedTrip, saveCachedTrip } from '@/lib/cache/tripCache'
import { buildDemoTrips } from '@/lib/demo/mockTrip'
import {
  diasEntre,
  type Moneda,
  type TripForm,
} from '@/lib/validations/tripForm'
import type { Activity, ActivityType } from '@/types/activity'
import type { Day, Trip } from '@/types/trip'

export interface GenerateResult {
  basico: Trip
  confort: Trip
  premium: Trip
  weather: WeatherData | null
  /** Moneda de todos los importes. */
  moneda: Moneda
  /** true solo cuando NO hay IA configurada (datos de ejemplo). */
  demo?: boolean
  /** Motivo legible del modo demo. */
  motivo?: string
}

/** Fase de progreso reportada al cliente durante el streaming. */
export interface ProgressEvent {
  fase:
    | 'cache'
    | 'demo'
    | 'contexto'
    | 'plan'
    | 'ia'
    | 'dias'
    | 'coords'
    | 'listo'
    | 'error'
  label: string
  /** Avance aproximado 0..1 (opcional). */
  progreso?: number
}

export type ProgressFn = (p: ProgressEvent) => void

export interface GenerateOptions {
  noCache?: boolean
  onProgress?: ProgressFn
  signal?: AbortSignal
  userId?: string | null
}

export interface GenerateOutcome {
  result: GenerateResult
  cacheHit: boolean
  demo: boolean
}

/** Error de generación con un mensaje apto para el usuario. */
export class GenerationError extends Error {
  readonly code: AiErrorCode | 'invalid'
  readonly mensaje: string
  constructor(code: AiErrorCode | 'invalid', mensaje: string, cause?: unknown) {
    super(mensaje, cause !== undefined ? { cause } : undefined)
    this.name = 'GenerationError'
    this.code = code
    this.mensaje = mensaje
  }
}

type Tier = 'basico' | 'confort' | 'premium'

const hoyISO = (): string => new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------------------
// Llamadas a la IA con JSON garantizado, reintento por truncamiento y reparación
// ---------------------------------------------------------------------------

const MAX_TOKENS_TOPE = 64_000

/**
 * Validación tolerante: los enum no se imponen en structured outputs, así que
 * aceptamos la forma general y dejamos que normalize.ts sanee los detalles.
 */
type Tolerante<T> = (json: unknown) => T | null

const conDias = <T>(json: unknown): T | null =>
  json &&
  typeof json === 'object' &&
  Array.isArray((json as { dias?: unknown }).dias)
    ? (json as T)
    : null

function esqueletoTolerante(json: unknown): EsqueletoIA | null {
  if (!json || typeof json !== 'object') return null
  const j = json as Record<string, unknown>
  if (!Array.isArray(j.dias) || j.dias.length === 0) return null
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  return {
    destino: str(j.destino),
    resumenViaje: str(j.resumenViaje),
    vueloIdaVueltaPorPersona: num(j.vueloIdaVueltaPorPersona, 0),
    advertencias: arr(j.advertencias),
    consejos: arr(j.consejos),
    presupuestoActividadesPorDia: num(j.presupuestoActividadesPorDia, 0),
    estancias: (Array.isArray(j.estancias) ? j.estancias : [])
      .filter(
        (e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object'
      )
      .map((e) => ({
        ciudad: str(e.ciudad),
        desdeDia: num(e.desdeDia, 1),
        hastaDia: num(e.hastaDia, 1),
        zona: str(e.zona),
        hotelBasico: str(e.hotelBasico),
        hotelConfort: str(e.hotelConfort),
        hotelPremium: str(e.hotelPremium),
        costeTotalBasico: num(e.costeTotalBasico, 0),
        costeTotalConfort: num(e.costeTotalConfort, 0),
        costeTotalPremium: num(e.costeTotalPremium, 0),
      })),
    dias: j.dias
      .filter(
        (d): d is Record<string, unknown> => Boolean(d) && typeof d === 'object'
      )
      .map((d, i) => ({
        numero: num(d.numero, i + 1),
        ciudad: str(d.ciudad),
        titulo: str(d.titulo),
        foco: str(d.foco),
        lugaresClave: arr(d.lugaresClave),
        esDiaDeTraslado: Boolean(d.esDiaDeTraslado),
      })),
  }
}

async function llamarJson<S extends z.ZodType>(
  schema: S,
  prompt: string,
  maxTokens: number,
  opts: GenerateOptions & { endpoint: string },
  tolerante: Tolerante<z.infer<S>> = conDias
): Promise<z.infer<S>> {
  let tokens = Math.min(maxTokens, MAX_TOKENS_TOPE)
  let ultimoTexto = ''
  for (let intento = 0; intento < 3; intento++) {
    const reparar =
      intento > 0 && ultimoTexto
        ? `\n\nTu respuesta anterior no era un JSON válido según el esquema. Vuelve a generarla COMPLETA y válida.`
        : ''
    const r = await aiGenerate({
      task: 'itinerario',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt + reparar }],
      maxTokens: tokens,
      schema: jsonSchemaOf(schema),
      endpoint: opts.endpoint,
      ...(opts.userId !== undefined ? { userId: opts.userId } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
    })
    if (r.stopReason === 'max_tokens') {
      // Truncado: reintentamos con más margen (la salida estructurada no se
      // puede "continuar").
      if (tokens >= MAX_TOKENS_TOPE) {
        throw new GenerationError(
          'truncated',
          'El itinerario salió demasiado largo. Vuelve a intentarlo o acorta el viaje.'
        )
      }
      tokens = Math.min(Math.round(tokens * 1.7), MAX_TOKENS_TOPE)
      ultimoTexto = ''
      continue
    }
    ultimoTexto = r.text
    try {
      const json = extractJson<unknown>(r.text)
      const parsed = schema.safeParse(json)
      if (parsed.success) return parsed.data as z.infer<S>
      const aceptado = tolerante(json)
      if (aceptado) return aceptado
    } catch {
      // JSON irrecuperable → reintento con aviso de reparación
    }
  }
  throw new GenerationError(
    'unknown',
    'La IA no pudo generar un itinerario válido. Inténtalo de nuevo.'
  )
}

/** Ejecuta tareas con un máximo de `n` simultáneas. */
async function enParalelo<T, R>(
  items: T[],
  n: number,
  fn: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i] as T, i)
      }
    })
  )
  return out
}

// ---------------------------------------------------------------------------
// Variantes por paquete
// ---------------------------------------------------------------------------

interface Variante {
  nombre: string
  descripcion: string
  tipo: ActivityType
  direccion: string
  lat: number
  lng: number
  precioEstimado: number
  reservaRequerida: boolean
}

type MapaVariantes = Map<string, { basico?: Variante; premium?: Variante }>

function leerVariante(v: unknown): Variante | undefined {
  if (!v || typeof v !== 'object') return undefined
  const r = v as Record<string, unknown>
  const nombre = str(r.nombre)
  if (!nombre) return undefined
  const tipo = str(r.tipo) as ActivityType
  return {
    nombre,
    descripcion: str(r.descripcion),
    tipo: TIPOS_ACTIVIDAD.includes(tipo) ? tipo : 'actividad',
    direccion: str(r.direccion),
    lat: num(r.lat, 0),
    lng: num(r.lng, 0),
    precioEstimado: Math.max(0, Math.round(num(r.precioEstimado, 0))),
    reservaRequerida: Boolean(r.reservaRequerida),
  }
}

/**
 * Normaliza los días de la IA asignando ids únicos ANTES de normalizar (para
 * no perder la relación con sus variantes al reordenar por hora).
 */
function normalizarDias(
  diasIA: DiaIA[],
  nDias: number
): { dias: Day[]; variantes: MapaVariantes } {
  const variantes: MapaVariantes = new Map()
  const usados = new Set<string>()
  const ordenados = [...diasIA]
    .filter((d) => d && typeof d === 'object')
    .sort((a, b) => num(a.numero, 0) - num(b.numero, 0))
    .slice(0, nDias)

  const dias = ordenados.map((d, i) => {
    const actividades = (Array.isArray(d.actividades) ? d.actividades : []).map(
      (a) => {
        const id = crypto.randomUUID()
        const vt = (a as { variantesTier?: unknown }).variantesTier
        if (vt && typeof vt === 'object') {
          const basico = leerVariante((vt as Record<string, unknown>).basico)
          const premium = leerVariante((vt as Record<string, unknown>).premium)
          if (basico || premium) {
            variantes.set(id, {
              ...(basico ? { basico } : {}),
              ...(premium ? { premium } : {}),
            })
          }
        }
        return { ...(a as Record<string, unknown>), id }
      }
    )
    return normalizeDay({ ...(d as Record<string, unknown>), actividades }, i, {
      usados,
    })
  })
  return { dias, variantes }
}

/** Factor de coste de los traslados por paquete (transporte público vs privado). */
const FACTOR_TRASLADO: Record<Tier, number> = {
  basico: 0.55,
  confort: 1,
  premium: 2.2,
}

function aplicarTier(
  base: Trip,
  tier: Tier,
  variantes: MapaVariantes,
  anclasDia: (GeoPoint | null)[]
): Trip {
  if (tier === 'confort') return base
  const dias = base.dias.map((d, di) => {
    let delta = 0
    const actividades = d.actividades.map((a): Activity => {
      const v = variantes.get(a.id)?.[tier]
      if (v && a.tipo !== 'traslado') {
        const ancla = anclasDia[di]
        const coordsOk =
          !(v.lat === 0 && v.lng === 0) &&
          Math.abs(v.lat) <= 90 &&
          Math.abs(v.lng) <= 180 &&
          (!ancla || haversineKm(ancla, v) <= 80)
        delta += v.precioEstimado - a.precioEstimado
        return {
          ...a,
          nombre: v.nombre,
          descripcion: v.descripcion || a.descripcion,
          tipo: v.tipo,
          direccion: v.direccion || a.direccion,
          lat: coordsOk ? v.lat : 0,
          lng: coordsOk ? v.lng : 0,
          coordsVerificadas: false,
          precioEstimado: v.precioEstimado,
          reservaRequerida: v.reservaRequerida,
        }
      }
      if (a.tipo === 'traslado' && a.precioEstimado > 0) {
        const nuevo = Math.round(a.precioEstimado * FACTOR_TRASLADO[tier])
        delta += nuevo - a.precioEstimado
        return { ...a, precioEstimado: nuevo }
      }
      return a
    })
    return {
      ...d,
      actividades,
      presupuestoDia: Math.max(0, Math.round(d.presupuestoDia + delta)),
    }
  })
  return recalcularTotales({
    ...base,
    id: crypto.randomUUID(),
    paquete: tier,
    dias,
  })
}

function recalcularTotales(trip: Trip): Trip {
  const presupuestoTotal = trip.dias.reduce((s, d) => s + d.presupuestoDia, 0)
  return {
    ...trip,
    presupuestoTotal,
    presupuestoPorPersona: Math.round(
      presupuestoTotal / Math.max(1, trip.personas)
    ),
  }
}

/** Escala todos los importes de un trip por `factor`. */
function escalarDinero(trip: Trip, factor: number): Trip {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return trip
  const r = (n: number): number => Math.round(n * factor)
  return recalcularTotales({
    ...trip,
    dias: trip.dias.map((d) => ({
      ...d,
      presupuestoDia: r(d.presupuestoDia),
      actividades: d.actividades.map((a) => ({
        ...a,
        precioEstimado: r(a.precioEstimado),
      })),
    })),
  })
}

/** Garantiza básico < confort < premium (las variantes pueden no serlo). */
function ordenarTiers(t: Record<Tier, Trip>): Record<Tier, Trip> {
  let { basico, premium } = t
  const { confort } = t
  const c = confort.presupuestoTotal
  if (c > 0) {
    if (basico.presupuestoTotal >= c * 0.95) {
      basico = escalarDinero(
        basico,
        (c * 0.75) / Math.max(1, basico.presupuestoTotal)
      )
    }
    if (premium.presupuestoTotal <= c * 1.15) {
      premium = escalarDinero(
        premium,
        (c * 1.45) / Math.max(1, premium.presupuestoTotal)
      )
    }
  }
  return { basico, confort, premium }
}

const NOTA_TIER: Record<Tier, string> = {
  basico:
    'Versión económica: alojamiento sencillo, transporte público y planes de bajo coste.',
  confort: '',
  premium:
    'Versión premium: alojamiento de lujo, traslados privados y experiencias exclusivas.',
}

// ---------------------------------------------------------------------------
// Coordenadas
// ---------------------------------------------------------------------------

/** Geocodifica una lista de ciudades (máx. 8, en serie por Nominatim). */
async function geocodeCiudades(
  ciudades: string[],
  previas: Map<string, GeoPoint | null> = new Map()
): Promise<Map<string, GeoPoint | null>> {
  const mapa = new Map(previas)
  const unicas = [...new Set(ciudades.map((c) => c.trim()).filter(Boolean))]
  for (const c of unicas.slice(0, 8)) {
    if (!mapa.has(c)) mapa.set(c, await geocode(c))
  }
  return mapa
}

/** Ancla (centro de la ciudad) de cada día; cae al centro del viaje. */
async function anclasPorDia(
  dias: Day[],
  anclaViaje: GeoPoint | null,
  previas?: Map<string, GeoPoint | null>
): Promise<(GeoPoint | null)[]> {
  const mapa = await geocodeCiudades(
    dias.map((d) => d.ciudad),
    previas
  )
  return dias.map((d) => mapa.get(d.ciudad.trim()) ?? anclaViaje)
}

/**
 * Verifica con el geocoder las actividades principales (máx `max`) y descarta
 * coordenadas inventadas lejos de la ciudad del día. El resto se completa en
 * segundo plano desde el cliente (useBackgroundGeocode).
 */
async function verificarCoordenadas(
  dias: Day[],
  anclas: (GeoPoint | null)[],
  max: number,
  esCrucero: boolean
): Promise<Day[]> {
  // 1) Descartar coords lejanas del ancla del día.
  let out = dias.map((d, i) => ({
    ...d,
    actividades: descartarCoordsLejanas(
      d.actividades,
      anclas[i] ?? null,
      esCrucero ? 400 : 120
    ),
  }))

  // 2) Geocodificar las más relevantes: primero las que no tienen coords.
  const candidatas: { di: number; ai: number; prioridad: number }[] = []
  out.forEach((d, di) =>
    d.actividades.forEach((a, ai) => {
      if (a.tipo === 'traslado' || /check-?in|check-?out/i.test(a.nombre))
        return
      const sinCoords = a.lat === 0 && a.lng === 0
      candidatas.push({ di, ai, prioridad: (sinCoords ? 0 : 10) + ai })
    })
  )
  candidatas.sort((x, y) => x.prioridad - y.prioridad)

  for (const c of candidatas.slice(0, max)) {
    const d = out[c.di]
    const a = d?.actividades[c.ai]
    if (!d || !a) continue
    const ancla = anclas[c.di] ?? null
    const punto = await geocode(`${a.nombre}, ${d.ciudad}`, {
      ...(ancla ? { near: ancla, radiusKm: 60 } : {}),
    })
    if (!punto) continue
    out = out.map((dd, di) =>
      di !== c.di
        ? dd
        : {
            ...dd,
            actividades: dd.actividades.map((aa, ai) =>
              ai !== c.ai
                ? aa
                : {
                    ...aa,
                    lat: punto.lat,
                    lng: punto.lng,
                    coordsVerificadas: true,
                  }
            ),
          }
    )
  }

  return out.map((d) => ({
    ...d,
    actividades: ajustarTiemposTraslado(d.actividades),
  }))
}

// ---------------------------------------------------------------------------
// Presupuesto: advertencia automática si el plan se sale
// ---------------------------------------------------------------------------

const fmt = (n: number, moneda: Moneda): string =>
  new Intl.NumberFormat('es', {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(n)

function advertirPresupuesto(trip: Trip, form: TripForm): Trip {
  const vuelos = (trip.vueloEstimadoPorPersona ?? 0) * trip.personas
  const total = trip.presupuestoTotal + vuelos
  if (total <= form.presupuesto * 1.08) return trip
  const yaAvisa = trip.advertencias.some((a) =>
    /presupuesto|no alcanza|insuficiente|excede|ajustad/i.test(a)
  )
  if (yaAvisa) return trip
  const detalle =
    vuelos > 0
      ? ` (${fmt(trip.presupuestoTotal, form.moneda)} en destino + ~${fmt(vuelos, form.moneda)} en vuelos)`
      : ''
  return {
    ...trip,
    advertencias: [
      `Este plan cuesta aprox. ${fmt(total, form.moneda)}${detalle}, por encima de tu presupuesto de ${fmt(form.presupuesto, form.moneda)}. Prueba el paquete básico o pide a la IA que lo abarate.`,
      ...trip.advertencias,
    ],
  }
}

// ---------------------------------------------------------------------------
// Orquestador
// ---------------------------------------------------------------------------

function demoResult(form: TripForm): GenerateResult {
  return {
    ...buildDemoTrips(form),
    moneda: form.moneda,
    demo: true,
    motivo:
      'Estás viendo un itinerario de ejemplo: la generación con IA todavía no está activada en esta instalación.',
  }
}

interface ViajeBase {
  destino: string
  resumenViaje: string
  vueloIdaVueltaPorPersona: number
  advertencias: string[]
  consejos: string[]
  dias: DiaIA[]
}

/**
 * Genera los 3 paquetes del viaje (con caché, contexto real, generación por
 * bloques en paralelo para viajes largos y validación/normalización de todo
 * lo que devuelve la IA). Lanza GenerationError si la IA falla.
 */
export async function generateTrips(
  form: TripForm,
  opts: GenerateOptions = {}
): Promise<GenerateOutcome> {
  const { noCache = false, onProgress } = opts
  const emit = (
    fase: ProgressEvent['fase'],
    label: string,
    progreso?: number
  ): void =>
    onProgress?.({
      fase,
      label,
      ...(progreso !== undefined ? { progreso } : {}),
    })

  if (!noCache) {
    const cached = await getCachedTrip(form)
    if (cached) {
      emit('cache', 'Recuperando un plan que ya teníamos listo', 1)
      return {
        result: JSON.parse(cached) as GenerateResult,
        cacheHit: true,
        demo: false,
      }
    }
  }

  if (!aiConfigured()) {
    emit('demo', 'Mostrando un itinerario de ejemplo', 1)
    return { result: demoResult(form), cacheHit: false, demo: true }
  }

  const hoy = hoyISO()
  const nDias = diasEntre(form.fechaInicio, form.fechaFin)
  const esCrucero = form.tipo === 'crucero'

  try {
    // 1) Contexto real: centro del destino y clima de esas fechas.
    emit('contexto', 'Ubicando tu destino y revisando el clima', 0.05)
    let anclaViaje = form.destinoSorpresa ? null : await geocode(form.destino)
    const climaViaje = anclaViaje
      ? await getTripWeather(anclaViaje, form.fechaInicio, form.fechaFin, hoy)
      : null
    const ctx: ItineraryContext = {
      anchor: anclaViaje,
      clima: climaViaje?.resumen ? { resumen: climaViaje.resumen } : null,
      hoy,
    }
    const base = { ...opts, endpoint: 'generate' }

    // 2) Generación.
    let viaje: ViajeBase
    // En viajes largos geocodificamos las ciudades del esqueleto MIENTRAS la
    // IA detalla los días (Nominatim va en serie y así no suma latencia).
    let ciudadesPrevias: Promise<Map<string, GeoPoint | null>> =
      Promise.resolve(new Map())
    if (nDias <= UMBRAL_UNA_LLAMADA) {
      emit('ia', 'La IA está diseñando tu viaje', 0.15)
      const completo = await llamarJson(
        ViajeCompletoSchema,
        buildViajeCompletoPrompt(form, ctx),
        5000 * nDias + 8000,
        base
      )
      viaje = completo
    } else {
      emit('plan', 'Trazando la ruta y eligiendo hoteles', 0.12)
      const esqueleto: EsqueletoIA = await llamarJson(
        EsqueletoSchema,
        buildEsqueletoPrompt(form, ctx),
        700 * nDias + 8000,
        { ...base, endpoint: 'generate:esqueleto' },
        esqueletoTolerante
      )
      if (form.destinoSorpresa && !anclaViaje) {
        anclaViaje = await geocode(esqueleto.destino)
        ctx.anchor = anclaViaje
      }
      ciudadesPrevias = geocodeCiudades(
        esqueleto.dias.map((d) => d.ciudad)
      ).catch(() => new Map<string, GeoPoint | null>())
      const bloques: [number, number][] = []
      for (let d = 1; d <= nDias; d += DIAS_POR_BLOQUE) {
        bloques.push([d, Math.min(nDias, d + DIAS_POR_BLOQUE - 1)])
      }
      let hechos = 0
      emit('dias', `Detallando los ${nDias} días en paralelo`, 0.25)
      const resultados = await enParalelo(
        bloques,
        6,
        async ([desde, hasta]) => {
          const esperados = hasta - desde + 1
          let dias: DiaIA[] = []
          // Un reintento si el bloque vuelve incompleto o con días vacíos.
          for (let intento = 0; intento < 2; intento++) {
            const r = await llamarJson(
              BloqueDiasSchema,
              buildBloquePrompt(form, ctx, esqueleto, desde, hasta),
              5000 * esperados + 8000,
              { ...base, endpoint: 'generate:bloque' }
            )
            dias = r.dias.filter(
              (d) => Array.isArray(d.actividades) && d.actividades.length > 0
            )
            if (dias.length >= esperados) break
          }
          hechos++
          emit(
            'dias',
            hasta > desde
              ? `Días ${desde} y ${hasta} listos`
              : `Día ${desde} listo`,
            0.25 + 0.55 * (hechos / bloques.length)
          )
          // Fuerza la numeración esperada del bloque.
          return dias
            .slice(0, esperados)
            .map((d, i) => ({ ...d, numero: desde + i }))
        }
      )
      viaje = {
        destino: esqueleto.destino,
        resumenViaje: esqueleto.resumenViaje,
        vueloIdaVueltaPorPersona: esqueleto.vueloIdaVueltaPorPersona,
        advertencias: esqueleto.advertencias,
        consejos: esqueleto.consejos,
        dias: resultados.flat(),
      }
    }

    // 3) Normalización y validación.
    const { dias: diasNorm, variantes } = normalizarDias(viaje.dias, nDias)
    if (diasNorm.length < nDias) {
      throw new GenerationError(
        'invalid',
        'La IA devolvió un itinerario incompleto. Inténtalo de nuevo.'
      )
    }
    if (diasNorm.some((d) => d.actividades.length === 0)) {
      throw new GenerationError(
        'invalid',
        'La IA devolvió días vacíos. Inténtalo de nuevo.'
      )
    }

    // 4) Coordenadas reales.
    emit('coords', 'Verificando las ubicaciones en el mapa', 0.85)
    const destino = str(viaje.destino) || form.destino
    if (!anclaViaje) anclaViaje = await geocode(destino)
    const anclas = await anclasPorDia(
      diasNorm,
      anclaViaje,
      await ciudadesPrevias
    )
    const dias = await verificarCoordenadas(
      diasNorm,
      anclas,
      nDias <= 3 ? 8 : 10,
      esCrucero
    )

    // 5) Paquetes.
    const confort: Trip = advertirPresupuesto(
      recalcularTotales({
        id: crypto.randomUUID(),
        destino,
        origen: form.origen,
        personas: form.personas,
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        presupuestoTotal: 0,
        presupuestoPorPersona: 0,
        dias,
        paquete: 'confort',
        moneda: form.moneda,
        vueloEstimadoPorPersona: Math.max(
          0,
          Math.round(num(viaje.vueloIdaVueltaPorPersona, 0))
        ),
        resumenViaje: str(viaje.resumenViaje),
        consejos: (viaje.consejos ?? []).filter(
          (c) => typeof c === 'string' && c.trim()
        ),
        advertencias: (viaje.advertencias ?? []).filter(
          (c) => typeof c === 'string' && c.trim()
        ),
        listaActividades: [],
        actividadesPendientes: [],
      }),
      form
    )
    const tiers = ordenarTiers({
      basico: aplicarTier(confort, 'basico', variantes, anclas),
      confort,
      premium: aplicarTier(confort, 'premium', variantes, anclas),
    })
    for (const t of ['basico', 'premium'] as const) {
      tiers[t] = {
        ...tiers[t],
        resumenViaje: `${NOTA_TIER[t]} ${tiers[t].resumenViaje}`.trim(),
      }
    }

    const result: GenerateResult = {
      ...tiers,
      weather: climaViaje?.weather ?? null,
      moneda: form.moneda,
    }
    await saveCachedTrip(form, JSON.stringify(result))
    emit('listo', '¡Tu viaje está listo!', 1)
    return { result, cacheHit: false, demo: false }
  } catch (err) {
    if (opts.signal?.aborted) throw err
    Sentry.captureException(err, { tags: { area: 'generate-itinerary' } })
    if (err instanceof GenerationError) throw err
    const { code, mensaje } = describeAiError(err)
    throw new GenerationError(code, mensaje, err)
  }
}
