/**
 * Geocodificación con OpenStreetMap Nominatim (gratis, sin API key).
 *
 * Política de uso de Nominatim: máximo 1 petición/segundo por aplicación,
 * User-Agent identificable con contacto y caché de resultados. Aquí:
 *  - todas las llamadas pasan por una cola serie con ≥1,1 s entre peticiones
 *    (por instancia) y, si hay Upstash configurado, un candado global de 1 rps;
 *  - caché en memoria (7 días) + caché de fetch de Next;
 *  - User-Agent con contacto (NOMINATIM_EMAIL o la URL pública).
 * Para producción con mucho tráfico conviene un geocoder comercial.
 */

import { getBaseUrl } from '@/lib/utils/baseUrl'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const MIN_GAP_MS = 1100
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface GeoPoint {
  lat: number
  lng: number
  displayName: string
  /** Código ISO de país en minúsculas (p. ej. 'jp'), si se conoce. */
  countryCode?: string
}

export interface GeocodeOptions {
  /** Sesga (y limita) la búsqueda a un radio alrededor de este punto. */
  near?: { lat: number; lng: number }
  /** Radio en km para `near` (por defecto 80). */
  radiusKm?: number
  /** Limita a estos países (ISO 3166-1 alfa-2). */
  countryCodes?: string[]
}

const cache = new Map<string, { at: number; value: GeoPoint | null }>()
let cola: Promise<unknown> = Promise.resolve()
let ultima = 0

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms))

/** Candado global de 1 rps vía Upstash (si está configurado). */
async function esperarTurnoGlobal(): Promise<void> {
  const url = process.env['UPSTASH_REDIS_REST_URL']
  const token = process.env['UPSTASH_REDIS_REST_TOKEN']
  if (!url || !token) return
  for (let intento = 0; intento < 8; intento++) {
    try {
      const res = await fetch(
        `${url.replace(/\/$/, '')}/set/nominatim:lock/1/NX/PX/${MIN_GAP_MS}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
      )
      const data = (await res.json()) as { result?: string | null }
      if (data.result === 'OK') return
    } catch {
      return // si Upstash falla, seguimos con el límite local
    }
    await sleep(MIN_GAP_MS / 2)
  }
}

/** Ejecuta `fn` respetando el ritmo de Nominatim. */
function enCola<T>(fn: () => Promise<T>): Promise<T> {
  const run = cola.then(async () => {
    const espera = ultima + MIN_GAP_MS - Date.now()
    if (espera > 0) await sleep(espera)
    await esperarTurnoGlobal()
    try {
      return await fn()
    } finally {
      ultima = Date.now()
    }
  })
  cola = run.catch(() => undefined)
  return run
}

function userAgent(): string {
  const contacto = process.env['NOMINATIM_EMAIL'] ?? getBaseUrl()
  return `Wayio/1.0 (planificador de viajes; ${contacto})`
}

function viewbox(near: { lat: number; lng: number }, km: number): string {
  const dLat = km / 111
  const dLng = km / (111 * Math.max(0.1, Math.cos((near.lat * Math.PI) / 180)))
  const left = near.lng - dLng
  const right = near.lng + dLng
  const top = near.lat + dLat
  const bottom = near.lat - dLat
  return `${left},${top},${right},${bottom}`
}

export async function geocode(
  query: string,
  opts: GeocodeOptions = {}
): Promise<GeoPoint | null> {
  const q = query.trim()
  if (!q) return null

  const cacheKey = JSON.stringify([
    q.toLowerCase(),
    opts.near ? [opts.near.lat.toFixed(2), opts.near.lng.toFixed(2)] : null,
    opts.radiusKm ?? null,
    opts.countryCodes ?? null,
  ])
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: '1',
    addressdetails: '1',
    'accept-language': 'es',
  })
  if (opts.near) {
    params.set('viewbox', viewbox(opts.near, opts.radiusKm ?? 80))
    params.set('bounded', '1')
  }
  if (opts.countryCodes?.length) {
    params.set('countrycodes', opts.countryCodes.join(','))
  }
  const email = process.env['NOMINATIM_EMAIL']
  if (email) params.set('email', email)

  const value = await enCola(async (): Promise<GeoPoint | null> => {
    try {
      const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: { 'User-Agent': userAgent(), 'Accept-Language': 'es' },
        next: { revalidate: 60 * 60 * 24 * 7 },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return null
      const data = (await res.json()) as Array<{
        lat: string
        lon: string
        display_name: string
        address?: { country_code?: string }
      }>
      const first = data[0]
      if (!first) return null
      const lat = Number(first.lat)
      const lng = Number(first.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return {
        lat,
        lng,
        displayName: first.display_name,
        ...(first.address?.country_code
          ? { countryCode: first.address.country_code }
          : {}),
      }
    } catch {
      return null
    }
  })

  cache.set(cacheKey, { at: Date.now(), value })
  if (cache.size > 2000) {
    const masViejo = cache.keys().next().value
    if (masViejo !== undefined) cache.delete(masViejo)
  }
  return value
}
