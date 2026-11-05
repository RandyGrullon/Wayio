import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { unstable_cache } from 'next/cache'
import { buildBookingLink } from '@/constants/affiliateLinks'
import { searchHotels as enlaceBooking } from './booking'
import type { SearchResponse, SearchResult } from './types'

/**
 * Hoteles con precio de LiteAPI (Nuitee) v3.0.
 *
 * Documentación oficial consultada el 2026-11-05:
 * - https://docs.liteapi.travel/reference/authentication (cabecera X-API-Key)
 * - https://docs.liteapi.travel/reference/get_data-places (texto → placeId)
 * - https://docs.liteapi.travel/reference/post_hotels-rates (tarifas)
 * - https://docs.liteapi.travel/docs/rate-request-parameters-guide
 * - https://docs.liteapi.travel/docs/hotel-rates-api-json-data-structure
 * - https://docs.liteapi.travel/reference/rate-limiting (sandbox 5 rps,
 *   producción 250 rps; 429 si se pasa)
 * - https://docs.liteapi.travel/docs/getting-a-sandbox-key
 * - https://docs.liteapi.travel/docs/whitelabel-booking-site y
 *   https://docs.liteapi.travel/docs/deeplinking-to-whitelabel
 *
 * Flujo: GET /data/places?textQuery=<destino> da el placeId (caché 30 días) y
 * POST /hotels/rates con placeId, fechas y ocupación da la tarifa más barata
 * de cada hotel (maxRatesPerHotel=1) con los datos del hotel
 * (includeHotelData). El precio es `offerRetailRate`: el total de la estancia
 * para todas las habitaciones, con comisión e impuestos incluidos según el
 * proveedor (puede haber tasas a pagar en el hotel). Son tarifas en vivo,
 * cacheadas 30 min aquí: se muestran como «desde» y con aviso de cambio.
 *
 * Reserva: LiteAPI no tiene enlace de afiliado; se reserva en su sitio de
 * marca blanca (Whitelabel, comisión para la cuenta). Si LITEAPI_WHITELABEL_URL
 * está configurada, cada hotel enlaza a su ficha ahí; si no, a Booking.com
 * con el AID de afiliado. Con una clave de sandbox los precios son de prueba
 * (la respuesta trae sandbox=true) y se avisa en pantalla.
 *
 * Variables (solo servidor): LITEAPI_KEY (la activa), LITEAPI_BASE_URL
 * (opcional, para un mock local), LITEAPI_WHITELABEL_URL (opcional) y
 * LITEAPI_GUEST_NATIONALITY (opcional, ISO-2, por defecto 'DO').
 */

const DEFAULT_BASE_URL = 'https://api.liteapi.travel/v3.0'
const TIMEOUT_LUGAR_MS = 5000
const TIMEOUT_TARIFAS_MS = 12_000
/** Segundos que LiteAPI espera a sus proveedores (recomienda 6-12). */
const TIMEOUT_PROVEEDOR_S = 8
const CACHE_LUGAR_SEGUNDOS = 30 * 24 * 60 * 60
const CACHE_TARIFAS_SEGUNDOS = 30 * 60
/** Hoteles que se consultan (no tarifas); por defecto LiteAPI usa 200. */
const HOTELES_A_CONSULTAR = 40
const MAX_RESULTADOS = 12
const NACIONALIDAD_POR_DEFECTO = 'DO'

/** Monedas que pedimos (DOP no se pide: se usa USD). */
export type MonedaHoteles = 'USD' | 'EUR'

export interface HotelRatesParams {
  destino: string
  checkIn: string
  checkOut: string
  huespedes: number
  moneda: MonedaHoteles
}

export function liteapiConfigured(): boolean {
  return Boolean(process.env['LITEAPI_KEY']?.trim())
}

function baseUrl(): string {
  const custom = process.env['LITEAPI_BASE_URL']?.trim()
  return (custom || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function nacionalidad(): string {
  const v = process.env['LITEAPI_GUEST_NATIONALITY']?.trim().toUpperCase()
  return v && /^[A-Z]{2}$/.test(v) ? v : NACIONALIDAD_POR_DEFECTO
}

/** Origen https del sitio de marca blanca, o undefined si no hay (o no vale). */
function whitelabel(): string | undefined {
  const v = process.env['LITEAPI_WHITELABEL_URL']?.trim()
  if (!v) return undefined
  try {
    const u = new URL(v)
    return u.protocol === 'https:' ? u.origin : undefined
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Utilidades
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

function urlHttps(v: unknown): string | undefined {
  const s = texto(v)
  if (!s) return undefined
  try {
    const u = new URL(s)
    return u.protocol === 'https:' ? u.toString() : undefined
  } catch {
    return undefined
  }
}

function recortar(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}

/** 'YYYY-MM-DD' del día siguiente (UTC). */
function diaSiguiente(fecha: string): string {
  const t = Date.parse(`${fecha}T00:00:00Z`)
  if (!Number.isFinite(t)) return fecha
  return new Date(t + 86_400_000).toISOString().slice(0, 10)
}

function noches(checkIn: string, checkOut: string): number {
  const d =
    (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) /
    86_400_000
  return Number.isFinite(d) && d > 0 ? Math.round(d) : 1
}

export interface Ocupacion {
  adults: number
  children: number[]
}

/** Habitaciones de 2 adultos como máximo ('3' → 2 + 1). */
export function ocupaciones(huespedes: number): Ocupacion[] {
  const n = Math.min(20, Math.max(1, Math.round(huespedes) || 1))
  const habitaciones = Math.ceil(n / 2)
  const base = Math.floor(n / habitaciones)
  const extra = n % habitaciones
  return Array.from({ length: habitaciones }, (_, i) => ({
    adults: base + (i < extra ? 1 : 0),
    children: [],
  }))
}

// ---------------------------------------------------------------------------
// Mapeo defensivo (lo cacheado es esta forma compacta, no la respuesta cruda)
// ---------------------------------------------------------------------------

export interface HotelTarifa {
  hotelId: string
  nombre: string
  precio: number
  moneda: string
  direccion?: string
  estrellas?: number
  /** Valoración de huéspedes en la escala de LiteAPI (0-10). */
  valoracion?: number
  resenas?: number
  imagen?: string
  reembolsable?: boolean
}

export interface TarifasCompactas {
  hoteles: HotelTarifa[]
  sandbox: boolean
}

function hotelesPorId(raw: Obj): Map<string, Obj> {
  const mapa = new Map<string, Obj>()
  const lista = Array.isArray(raw['hotels']) ? raw['hotels'] : []
  for (const h of lista) {
    if (!esObj(h)) continue
    const id = texto(h['id']) ?? texto(h['hotelId'])
    if (id) mapa.set(id, h)
  }
  return mapa
}

/**
 * Precio público sugerido (SSP) de la oferta en esa moneda, si viene. La
 * documentación de LiteAPI dice que es el precio que hay que mostrar al
 * vender al público (paridad de tarifas).
 */
function precioSugerido(rt: Obj, moneda: string): number | undefined {
  const lista = Array.isArray(rt['suggestedSellingPrice'])
    ? rt['suggestedSellingPrice']
    : []
  for (const s of lista) {
    if (!esObj(s)) continue
    const importe = numero(s['amount'])
    if (
      importe !== undefined &&
      importe > 0 &&
      texto(s['currency'])?.toUpperCase() === moneda
    ) {
      return importe
    }
  }
  return undefined
}

/**
 * Oferta más barata de un hotel entre sus roomTypes. El precio mostrado es
 * offerRetailRate, pero nunca por debajo del SSP: así no anunciamos un precio
 * menor que el que el usuario verá al reservar en el sitio público.
 */
function masBarata(
  roomTypes: unknown
): { precio: number; moneda: string; reembolsable: boolean } | undefined {
  if (!Array.isArray(roomTypes)) return undefined
  let mejor: { precio: number; moneda: string; reembolsable: boolean } | null =
    null
  for (const rt of roomTypes) {
    if (!esObj(rt)) continue
    const oferta = esObj(rt['offerRetailRate'])
      ? rt['offerRetailRate']
      : undefined
    const venta = numero(oferta?.['amount'])
    const moneda = texto(oferta?.['currency'])?.toUpperCase()
    if (venta === undefined || venta <= 0 || !moneda) continue
    const precio = Math.max(venta, precioSugerido(rt, moneda) ?? 0)
    if (mejor && precio >= mejor.precio) continue
    const tarifas = Array.isArray(rt['rates']) ? rt['rates'] : []
    const reembolsable =
      tarifas.length > 0 &&
      tarifas.every((r) => {
        const pol =
          esObj(r) && esObj(r['cancellationPolicies'])
            ? r['cancellationPolicies']
            : undefined
        return texto(pol?.['refundableTag']) === 'RFN'
      })
    mejor = { precio, moneda, reembolsable }
  }
  return mejor ?? undefined
}

export function normalizeLiteapiRates(raw: unknown): TarifasCompactas {
  if (!esObj(raw)) return { hoteles: [], sandbox: false }
  const sandbox = raw['sandbox'] === true
  const datos = hotelesPorId(raw)
  const lista = Array.isArray(raw['data']) ? raw['data'] : []
  const hoteles: HotelTarifa[] = []

  for (const item of lista) {
    if (!esObj(item)) continue
    const hotelId = texto(item['hotelId'])
    if (!hotelId) continue
    const info = datos.get(hotelId)
    const nombre = texto(info?.['name'])
    const oferta = masBarata(item['roomTypes'])
    if (!nombre || !oferta) continue

    const direccion = texto(info?.['address'])
    const estrellas = numero(info?.['stars'])
    const valoracion = numero(info?.['rating'])
    const resenas =
      numero(info?.['review_count']) ?? numero(info?.['reviewCount'])
    const imagen =
      urlHttps(info?.['thumbnail']) ?? urlHttps(info?.['main_photo'])

    hoteles.push({
      hotelId,
      nombre: recortar(nombre, 120),
      precio: oferta.precio,
      moneda: oferta.moneda,
      ...(direccion ? { direccion: recortar(direccion, 100) } : {}),
      ...(estrellas !== undefined && estrellas > 0 && estrellas <= 5
        ? { estrellas }
        : {}),
      ...(valoracion !== undefined && valoracion > 0 && valoracion <= 10
        ? { valoracion }
        : {}),
      ...(resenas !== undefined && resenas > 0
        ? { resenas: Math.round(resenas) }
        : {}),
      ...(imagen ? { imagen } : {}),
      ...(oferta.reembolsable ? { reembolsable: true } : {}),
    })
    if (hoteles.length >= MAX_RESULTADOS) break
  }
  return { hoteles, sandbox }
}

// ---------------------------------------------------------------------------
// Llamadas (cacheadas)
// ---------------------------------------------------------------------------

class LiteapiError extends Error {
  constructor(
    message: string,
    readonly status: number | null
  ) {
    super(message)
    this.name = 'LiteapiError'
  }
}

function clave(): string {
  const apiKey = process.env['LITEAPI_KEY']?.trim()
  if (!apiKey) throw new LiteapiError('sin clave', null)
  return apiKey
}

/** placeId de Google para un destino en texto libre (null si no hay). */
async function pedirLugar(
  base: string,
  destino: string
): Promise<string | null> {
  const params = new URLSearchParams({ textQuery: destino, language: 'es' })
  const res = await fetch(`${base}/data/places?${params}`, {
    headers: { 'X-API-Key': clave(), Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_LUGAR_MS),
  })
  if (!res.ok) {
    throw new LiteapiError(
      `LiteAPI /data/places respondió ${res.status}`,
      res.status
    )
  }
  const json: unknown = await res.json()
  const lista = esObj(json) && Array.isArray(json['data']) ? json['data'] : []
  for (const lugar of lista) {
    const id = esObj(lugar) ? texto(lugar['placeId']) : undefined
    if (id) return id
  }
  return null
}

const lugarCacheado = unstable_cache(pedirLugar, ['liteapi-place-v1'], {
  revalidate: CACHE_LUGAR_SEGUNDOS,
  tags: ['liteapi'],
})

interface ConsultaTarifas {
  base: string
  placeId: string
  checkin: string
  checkout: string
  ocupaciones: Ocupacion[]
  moneda: MonedaHoteles
  nacionalidad: string
}

async function pedirTarifas(c: ConsultaTarifas): Promise<TarifasCompactas> {
  const res = await fetch(`${c.base}/hotels/rates`, {
    method: 'POST',
    headers: {
      'X-API-Key': clave(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      placeId: c.placeId,
      checkin: c.checkin,
      checkout: c.checkout,
      occupancies: c.ocupaciones,
      currency: c.moneda,
      guestNationality: c.nacionalidad,
      limit: HOTELES_A_CONSULTAR,
      maxRatesPerHotel: 1,
      includeHotelData: true,
      timeout: TIMEOUT_PROVEEDOR_S,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_TARIFAS_MS),
  })
  if (!res.ok) {
    throw new LiteapiError(
      `LiteAPI /hotels/rates respondió ${res.status}`,
      res.status
    )
  }
  return normalizeLiteapiRates(await res.json())
}

// La caché solo guarda respuestas buenas: si la llamada lanza, no se cachea.
const tarifasCacheadas = unstable_cache(pedirTarifas, ['liteapi-rates-v1'], {
  revalidate: CACHE_TARIFAS_SEGUNDOS,
  tags: ['liteapi'],
})

function esTimeout(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'TimeoutError' || err.name === 'AbortError')
  )
}

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------

function enlaceHotel(
  h: HotelTarifa,
  p: HotelRatesParams,
  checkOut: string,
  ocupacion: Ocupacion[],
  placeId: string
): string {
  const wl = whitelabel()
  if (wl) {
    const params = new URLSearchParams({
      placeId,
      checkin: p.checkIn,
      checkout: checkOut,
      // Ocupación en base64 de JSON, como pide el deep link de la marca blanca.
      occupancies: btoa(JSON.stringify(ocupacion)),
      currency: p.moneda,
      language: 'es',
    })
    return `${wl}/hotels/${encodeURIComponent(h.hotelId)}?${params}`
  }
  return buildBookingLink(`${h.nombre}, ${p.destino.trim()}`, p.checkIn, {
    checkOut,
    adultos: p.huespedes,
    habitaciones: ocupacion.length,
  })
}

function notaPrecio(n: number, huespedes: number, habitaciones: number) {
  const partes = [
    `total de ${n === 1 ? '1 noche' : `${n} noches`}`,
    huespedes === 1 ? '1 huésped' : `${huespedes} huéspedes`,
  ]
  if (habitaciones > 1) partes.push(`${habitaciones} habitaciones`)
  return partes.join(', ')
}

const AVISO =
  'Precio total de la estancia según el proveedor: puede cambiar hasta que reserves y el hotel puede cobrar tasas locales aparte.'
const AVISO_SANDBOX =
  'Precios de prueba (no son reales). Precio total de la estancia: puede cambiar hasta que reserves.'

/**
 * Hoteles con precio. Siempre devuelve el contrato común (nunca lanza): si el
 * proveedor falla, configured=false con el enlace de Booking.com.
 */
export async function searchHotelRates(
  p: HotelRatesParams
): Promise<SearchResponse> {
  const { enlace } = enlaceBooking(p)
  // Viaje de un solo día (salida = regreso): se busca una noche.
  const checkOut = p.checkOut > p.checkIn ? p.checkOut : diaSiguiente(p.checkIn)
  const huespedes = Math.min(20, Math.max(1, Math.round(p.huespedes) || 1))
  const ocupacion = ocupaciones(huespedes)
  const base = baseUrl()
  const destino = p.destino.trim().replace(/\s+/g, ' ')

  try {
    const placeId = await lugarCacheado(base, destino)
    if (!placeId) {
      return {
        configured: true,
        results: [],
        mensaje:
          'No encontramos ese destino en nuestro buscador de hoteles. Míralo en Booking.com, con tus fechas ya puestas.',
        ...(enlace ? { enlace } : {}),
      }
    }
    const { hoteles, sandbox } = await tarifasCacheadas({
      base,
      placeId,
      checkin: p.checkIn,
      checkout: checkOut,
      ocupaciones: ocupacion,
      moneda: p.moneda,
      nacionalidad: nacionalidad(),
    })
    if (hoteles.length === 0) {
      return {
        configured: true,
        results: [],
        mensaje:
          'No encontramos hoteles con disponibilidad para esas fechas. Prueba en Booking.com o con otras fechas.',
        ...(enlace ? { enlace } : {}),
      }
    }

    const n = noches(p.checkIn, checkOut)
    const priceNote = notaPrecio(n, huespedes, ocupacion.length)
    const results: SearchResult[] = hoteles.map((h) => {
      const subtitulo = [
        h.estrellas !== undefined
          ? `${String(h.estrellas).replace('.', ',')} ${h.estrellas === 1 ? 'estrella' : 'estrellas'}`
          : undefined,
        h.direccion,
        h.reembolsable ? 'reembolsable' : undefined,
      ]
        .filter(Boolean)
        .join(' · ')
      return {
        id: `liteapi-${h.hotelId}`,
        title: h.nombre,
        provider: 'liteapi',
        price: h.precio,
        currency: h.moneda,
        priceNote,
        startDate: p.checkIn,
        endDate: checkOut,
        url: enlaceHotel(h, p, checkOut, ocupacion, placeId),
        ...(subtitulo ? { subtitle: recortar(subtitulo, 140) } : {}),
        ...(h.imagen ? { imageUrl: h.imagen } : {}),
        // LiteAPI puntúa de 0 a 10; el contrato usa 0-5.
        ...(h.valoracion !== undefined
          ? { rating: Math.round((h.valoracion / 2) * 10) / 10 }
          : {}),
        ...(h.resenas !== undefined ? { reviews: h.resenas } : {}),
      }
    })
    return {
      configured: true,
      results,
      aviso: sandbox ? AVISO_SANDBOX : AVISO,
      ...(enlace ? { enlace } : {}),
    }
  } catch (err) {
    const timeout = esTimeout(err)
    if (!timeout) {
      try {
        Sentry.captureException(err, { tags: { proveedor: 'liteapi' } })
      } catch {
        /* sin monitorización */
      }
    }
    return {
      configured: false,
      results: [],
      reason: timeout ? 'tiempo-agotado' : 'error-proveedor',
      mensaje:
        'No pudimos cargar los precios de hoteles ahora. Míralos en Booking.com, con tus fechas ya puestas.',
      ...(enlace ? { enlace } : {}),
    }
  }
}
