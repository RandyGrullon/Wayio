import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { unstable_cache } from 'next/cache'
import { buildFlightsLink, resolveIata } from '@/constants/affiliateLinks'
import type { SearchResponse, SearchResult } from './types'

/**
 * Vuelos con precio de la Aviasales Data API de Travelpayouts:
 * GET /aviasales/v3/prices_for_dates.
 *
 * Documentación oficial consultada el 2026-11-05:
 * - https://support.travelpayouts.com/hc/en-us/articles/203956163
 *   (Aviasales Data API: prices_for_dates, parámetros, campo `link`).
 * - https://support.travelpayouts.com/hc/en-us/articles/4402565416594-API-rate-limits
 *   (límites por minuto desde el 14-06-2024; prices_for_dates: 600/min).
 * - https://support.travelpayouts.com/hc/en-us/articles/360018907280-Data-in-json-format
 *   (data/en/airlines.json, sin token).
 *
 * Lo que importa:
 * - El token va en la cabecera X-Access-Token (nunca en la URL: así no queda
 *   en logs de acceso ni en errores).
 * - Los precios son de CACHÉ: los encontraron usuarios de Aviasales en las
 *   últimas 48 h (se guardan hasta 7 días). No son una cotización en vivo:
 *   se muestran como «desde», por persona y con el aviso de que pueden
 *   cambiar al reservar.
 * - Si no hay precios para las fechas exactas, se piden los del mes de ida
 *   (y de vuelta) y se avisa de que las fechas son cercanas.
 * - `link` es una ruta relativa a https://www.aviasales.com; se le añade el
 *   `marker` de afiliado (NEXT_PUBLIC_TP_MARKER) para cobrar la comisión.
 * - 429 si se pasa del límite: se trata como error del proveedor (la ruta ya
 *   limita por usuario/IP y aquí se cachea 1 h por búsqueda).
 *
 * Variables (solo servidor): TRAVELPAYOUTS_TOKEN (la activa),
 * TRAVELPAYOUTS_BASE_URL (opcional, para un mock local) y
 * TRAVELPAYOUTS_MARKET (opcional; por defecto el mercado lo decide el origen).
 */

const DEFAULT_BASE_URL = 'https://api.travelpayouts.com'
const AVIASALES_WEB = 'https://www.aviasales.com'
const TIMEOUT_MS = 8000
const CACHE_SEGUNDOS = 60 * 60
const CACHE_AEROLINEAS_SEGUNDOS = 7 * 24 * 60 * 60
const MAX_RESULTADOS = 10

/** Monedas que pedimos (DOP no se pide: se usa USD). */
export type MonedaVuelos = 'USD' | 'EUR'

export interface FlightSearchParams {
  /** Código IATA o ciudad ('SDQ', 'Santo Domingo'). */
  origen: string
  destino: string
  /** Ida 'YYYY-MM-DD'. */
  ida: string
  /** Vuelta 'YYYY-MM-DD' (si falta, solo ida). */
  vuelta?: string | undefined
  adultos: number
  moneda: MonedaVuelos
}

export function travelpayoutsConfigured(): boolean {
  return Boolean(process.env['TRAVELPAYOUTS_TOKEN']?.trim())
}

function baseUrl(): string {
  const custom = process.env['TRAVELPAYOUTS_BASE_URL']?.trim()
  return (custom || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

/** Mercado de datos opcional ('us', 'es'…): solo letras, 2-3 caracteres. */
function mercado(): string | undefined {
  const m = process.env['TRAVELPAYOUTS_MARKET']?.trim().toLowerCase()
  return m && /^[a-z]{2,3}$/.test(m) ? m : undefined
}

/** Marker de afiliado (el mismo filtro que los enlaces de affiliateLinks). */
function marker(): string | undefined {
  const v = process.env.NEXT_PUBLIC_TP_MARKER?.trim()
  if (!v) return undefined
  if (/^(?:tu[_-]|your[_-]|xxx|changeme|todo\b|<)/i.test(v)) return undefined
  return v
}

// ---------------------------------------------------------------------------
// Utilidades y mapeo defensivo
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>

const esObj = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const texto = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined

const numero = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

const FECHA = /^\d{4}-\d{2}-\d{2}/

/** 'YYYY-MM-DD' de una fecha ISO con hora ('2026-12-10T07:00:00-04:00'). */
const soloFecha = (v: unknown): string | undefined => {
  const s = texto(v)
  return s && FECHA.test(s) ? s.slice(0, 10) : undefined
}

/**
 * IATA de un lugar: la tabla de affiliateLinks y, si no está, el texto tal
 * cual si ya parece un código de 3 letras ('lim' → 'LIM').
 */
export function iataDe(lugar: string): string | null {
  const conocido = resolveIata(lugar)
  if (conocido) return conocido
  const crudo = lugar.trim()
  return /^[a-z]{3}$/i.test(crudo) ? crudo.toUpperCase() : null
}

function escalas(n: number | undefined): string | undefined {
  if (n === undefined || n < 0) return undefined
  if (n === 0) return 'sin escalas'
  return n === 1 ? '1 escala' : `${Math.round(n)} escalas`
}

/**
 * Enlace https a la oferta en Aviasales con el marker de afiliado y el número
 * de pasajeros del viaje. Solo acepta rutas relativas que se queden en
 * aviasales.com (nada de '//otro-dominio' ni 'javascript:').
 */
export function enlaceAviasales(
  link: unknown,
  adultos: number
): string | undefined {
  const ruta = texto(link)
  if (!ruta || !ruta.startsWith('/') || ruta.startsWith('//')) return undefined
  let url: URL
  try {
    url = new URL(ruta, AVIASALES_WEB)
  } catch {
    return undefined
  }
  if (url.origin !== AVIASALES_WEB) return undefined
  // '/search/SDQ1012MAD17121': el último dígito son los pasajeros (los
  // precios de caché son de 1 adulto). Se ajusta solo si encaja exacto.
  const n = Math.min(9, Math.max(1, Math.round(adultos) || 1))
  const m = /^\/search\/([A-Z]{3}\d{4}[A-Z]{3}(?:\d{4})?)\d$/.exec(url.pathname)
  if (m?.[1]) url.pathname = `/search/${m[1]}${n}`
  const mk = marker()
  if (mk) url.searchParams.set('marker', mk)
  return url.toString()
}

/** Logo de la aerolínea (servicio de imágenes de Aviasales). */
function logoAerolinea(codigo: string | undefined): string | undefined {
  return codigo && /^[A-Z0-9]{2}$/.test(codigo)
    ? `https://pics.avs.io/200/200/${codigo}.png`
    : undefined
}

/**
 * Nombres de respaldo de las aerolíneas más habituales desde RD y la región,
 * por si data/en/airlines.json no responde.
 */
const AEROLINEAS_FRECUENTES: Readonly<Record<string, string>> = {
  AA: 'American Airlines',
  AC: 'Air Canada',
  AF: 'Air France',
  AM: 'Aeroméxico',
  AV: 'Avianca',
  B6: 'JetBlue',
  BA: 'British Airways',
  CM: 'Copa Airlines',
  DL: 'Delta Air Lines',
  DM: 'Arajet',
  F9: 'Frontier Airlines',
  IB: 'Iberia',
  KL: 'KLM',
  LA: 'LATAM',
  LH: 'Lufthansa',
  NK: 'Spirit Airlines',
  TK: 'Turkish Airlines',
  UA: 'United Airlines',
  UX: 'Air Europa',
  WN: 'Southwest Airlines',
  WS: 'WestJet',
}

export interface OfertasCrudas {
  raw: unknown
  aerolineas: Readonly<Record<string, string>>
  adultos: number
  moneda: MonedaVuelos
  idaVuelta: boolean
}

export function normalizeTravelpayoutsPrices({
  raw,
  aerolineas,
  adultos,
  moneda,
  idaVuelta,
}: OfertasCrudas): SearchResult[] {
  if (!esObj(raw) || !Array.isArray(raw['data'])) return []
  const monedaRespuesta = texto(raw['currency'])?.toUpperCase()
  const currency =
    monedaRespuesta && /^[A-Z]{3}$/.test(monedaRespuesta)
      ? monedaRespuesta
      : moneda
  const vistos = new Set<string>()
  const resultados: SearchResult[] = []

  for (const item of raw['data']) {
    if (!esObj(item)) continue
    const price = numero(item['price'])
    if (price === undefined || price <= 0) continue

    const codigo = texto(item['airline'])?.toUpperCase()
    const numeroVuelo = numero(item['flight_number'])
    const vuelo =
      texto(item['flight_number']) ??
      (numeroVuelo !== undefined ? String(numeroVuelo) : '')
    const ida = soloFecha(item['departure_at'])
    const vuelta = soloFecha(item['return_at'])
    const origen = texto(item['origin_airport']) ?? texto(item['origin'])
    const destino =
      texto(item['destination_airport']) ?? texto(item['destination'])

    const id = `tp-${codigo ?? 'xx'}${vuelo}-${texto(item['departure_at']) ?? ''}-${texto(item['return_at']) ?? ''}`
    if (vistos.has(id)) continue
    vistos.add(id)

    const nombre = codigo
      ? (aerolineas[codigo] ?? AEROLINEAS_FRECUENTES[codigo])
      : undefined
    const title = nombre ?? (codigo ? `Aerolínea ${codigo}` : 'Vuelo')

    const escalasIda = escalas(numero(item['transfers']))
    const escalasVuelta = escalas(numero(item['return_transfers']))
    const tramos = [
      origen && destino ? `${origen} → ${destino}` : undefined,
      vuelta && escalasIda && escalasVuelta
        ? `ida ${escalasIda}, vuelta ${escalasVuelta}`
        : escalasIda,
    ].filter(Boolean)

    const minutos = numero(item['duration_to']) ?? numero(item['duration'])
    const url = enlaceAviasales(item['link'], adultos)
    const imageUrl = logoAerolinea(codigo)

    resultados.push({
      id,
      title,
      provider: 'travelpayouts',
      price,
      currency,
      priceNote:
        idaVuelta && vuelta
          ? 'por persona, ida y vuelta'
          : 'por persona, solo ida',
      ...(tramos.length ? { subtitle: tramos.join(' · ') } : {}),
      ...(ida ? { startDate: ida } : {}),
      ...(ida && vuelta ? { endDate: vuelta } : {}),
      ...(url ? { url } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(minutos !== undefined && minutos > 0
        ? { durationMinutes: Math.round(minutos) }
        : {}),
    })
    if (resultados.length >= MAX_RESULTADOS) break
  }
  return resultados
}

/** Mapa código → nombre a partir de data/en/airlines.json. */
export function normalizeAirlines(raw: unknown): Record<string, string> {
  const mapa: Record<string, string> = {}
  if (!Array.isArray(raw)) return mapa
  for (const a of raw) {
    if (!esObj(a)) continue
    const codigo = texto(a['code'])?.toUpperCase()
    const traducciones = esObj(a['name_translations'])
      ? a['name_translations']
      : undefined
    const nombre = texto(a['name']) ?? texto(traducciones?.['en'])
    if (codigo && /^[A-Z0-9]{2}$/.test(codigo) && nombre && !mapa[codigo]) {
      mapa[codigo] = nombre.slice(0, 60)
    }
  }
  return mapa
}

// ---------------------------------------------------------------------------
// Llamadas (cacheadas)
// ---------------------------------------------------------------------------

class TravelpayoutsError extends Error {
  constructor(
    message: string,
    readonly status: number | null
  ) {
    super(message)
    this.name = 'TravelpayoutsError'
  }
}

interface ConsultaPrecios {
  base: string
  origen: string
  destino: string
  /** 'YYYY-MM-DD' o 'YYYY-MM'. */
  ida: string
  vuelta: string | null
  moneda: MonedaVuelos
  mercado: string | null
}

async function pedirPrecios(c: ConsultaPrecios): Promise<unknown> {
  const token = process.env['TRAVELPAYOUTS_TOKEN']?.trim()
  if (!token) throw new TravelpayoutsError('sin token', null)

  const params = new URLSearchParams({
    origin: c.origen,
    destination: c.destino,
    departure_at: c.ida,
    // Con vuelta, one_way=false da más ofertas de ida y vuelta.
    one_way: c.vuelta ? 'false' : 'true',
    direct: 'false',
    sorting: 'price',
    limit: String(MAX_RESULTADOS * 2),
    page: '1',
    // La tabla de parámetros dice `currency` y el ejemplo oficial usa `cy`:
    // se mandan los dos con el mismo valor.
    currency: c.moneda.toLowerCase(),
    cy: c.moneda.toLowerCase(),
  })
  if (c.vuelta) params.set('return_at', c.vuelta)
  if (c.mercado) params.set('market', c.mercado)

  const res = await fetch(`${c.base}/aviasales/v3/prices_for_dates?${params}`, {
    headers: { 'X-Access-Token': token, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new TravelpayoutsError(
      `Travelpayouts respondió ${res.status}`,
      res.status
    )
  }
  const json: unknown = await res.json()
  if (esObj(json) && json['success'] === false) {
    throw new TravelpayoutsError('Travelpayouts respondió success=false', 200)
  }
  return json
}

// La caché solo guarda respuestas buenas: si la llamada lanza, no se cachea.
const preciosCacheados = unstable_cache(
  pedirPrecios,
  ['travelpayouts-prices-for-dates-v3'],
  { revalidate: CACHE_SEGUNDOS, tags: ['travelpayouts'] }
)

async function pedirAerolineas(base: string): Promise<Record<string, string>> {
  const res = await fetch(`${base}/data/en/airlines.json`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new TravelpayoutsError(
      `airlines.json respondió ${res.status}`,
      res.status
    )
  }
  const mapa = normalizeAirlines(await res.json())
  if (Object.keys(mapa).length === 0) {
    throw new TravelpayoutsError('airlines.json vacío', res.status)
  }
  return mapa
}

const aerolineasCacheadas = unstable_cache(
  pedirAerolineas,
  ['travelpayouts-airlines-v1'],
  { revalidate: CACHE_AEROLINEAS_SEGUNDOS, tags: ['travelpayouts'] }
)

/** Nombres de aerolíneas; si el fichero falla, el mapa de respaldo. */
async function aerolineas(base: string): Promise<Record<string, string>> {
  try {
    return await aerolineasCacheadas(base)
  } catch {
    return {}
  }
}

function esTimeout(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'TimeoutError' || err.name === 'AbortError')
  )
}

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------

const AVISO =
  'Precios orientativos de búsquedas recientes en Aviasales: pueden cambiar o agotarse al reservar.'
const AVISO_MES =
  'No hay precios guardados para tus fechas exactas: te mostramos los más baratos de ese mes. Precios orientativos de búsquedas recientes en Aviasales: pueden cambiar o agotarse al reservar.'

/**
 * Vuelos con precio. Siempre devuelve el contrato común (nunca lanza): si el
 * origen o el destino no tienen código IATA, reason 'parametros-invalidos';
 * si el proveedor falla, configured=false con el enlace del buscador.
 */
export async function searchFlights(
  p: FlightSearchParams
): Promise<SearchResponse> {
  const origen = iataDe(p.origen)
  const destino = iataDe(p.destino)
  // Con los códigos ya resueltos ('lim' → 'LIM') el enlace de respaldo va al
  // buscador del socio y no a la búsqueda en texto libre.
  const enlace = buildFlightsLink({
    origen: origen ?? p.origen,
    destino: destino ?? p.destino,
    ida: p.ida,
    vuelta: p.vuelta,
    personas: p.adultos,
  })
  if (!origen || !destino || origen === destino) {
    return {
      configured: true,
      results: [],
      reason: 'parametros-invalidos',
      mensaje:
        origen && origen === destino
          ? 'El origen y el destino son el mismo aeropuerto.'
          : 'No reconocemos esa ciudad: escribe el código IATA de su aeropuerto (por ejemplo, SDQ o MAD).',
      enlace,
    }
  }

  const base = baseUrl()
  const vuelta = p.vuelta && p.vuelta >= p.ida ? p.vuelta : null
  const consulta: ConsultaPrecios = {
    base,
    origen,
    destino,
    ida: p.ida,
    vuelta,
    moneda: p.moneda,
    mercado: mercado() ?? null,
  }
  try {
    const [raw, nombres] = await Promise.all([
      preciosCacheados(consulta),
      aerolineas(base),
    ])
    const comunes = {
      aerolineas: nombres,
      adultos: p.adultos,
      moneda: p.moneda,
      idaVuelta: vuelta !== null,
    }
    let results = normalizeTravelpayoutsPrices({ raw, ...comunes })
    let aviso = AVISO

    // Sin precios para el día exacto: los más baratos del mes.
    if (results.length === 0) {
      const rawMes = await preciosCacheados({
        ...consulta,
        ida: p.ida.slice(0, 7),
        vuelta: vuelta ? vuelta.slice(0, 7) : null,
      })
      results = normalizeTravelpayoutsPrices({ raw: rawMes, ...comunes })
      aviso = AVISO_MES
    }

    if (results.length === 0) {
      return {
        configured: true,
        results: [],
        mensaje:
          'No hay precios recientes para esa ruta. Míralos en el buscador del socio, con tus fechas ya puestas.',
        enlace,
      }
    }
    return { configured: true, results, aviso, enlace }
  } catch (err) {
    const timeout = esTimeout(err)
    if (!timeout) {
      try {
        Sentry.captureException(err, { tags: { proveedor: 'travelpayouts' } })
      } catch {
        /* sin monitorización */
      }
    }
    return {
      configured: false,
      results: [],
      reason: timeout ? 'tiempo-agotado' : 'error-proveedor',
      mensaje:
        'No pudimos cargar los precios de vuelos ahora. Compáralos en el sitio de nuestro socio, con tus fechas ya puestas.',
      enlace,
    }
  }
}
