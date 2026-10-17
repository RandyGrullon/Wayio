/**
 * Geocodificación de ciudades y lugares del itinerario.
 *
 * Con GEOAPIFY_API_KEY usa Geoapify (lib/api/geoapify.ts), apto para uso
 * comercial: sin cola de 1,1 s (el ritmo y el presupuesto diario de créditos
 * los regula geoapify.ts), con caché en memoria (7 días) y caché de datos de
 * Next compartida entre instancias (30 días; sus términos permiten guardar
 * los resultados). Las búsquedas de actividades (nivel 'lugar') descartan
 * los aciertos de ciudad o país con los que Geoapify responde si no
 * encuentra el sitio. Si Geoapify falla no se consulta Nominatim: el lugar
 * queda sin verificar.
 *
 * Sin la clave usa OpenStreetMap Nominatim (gratis, sin API key, pero solo
 * para uso moderado). Su política: máximo 1 petición/segundo por aplicación,
 * User-Agent identificable con contacto y caché de resultados. Aquí:
 *  - todas las llamadas pasan por una cola serie con ≥1,1 s entre peticiones
 *    (por instancia) y, si hay Upstash configurado, un candado global de 1 rps;
 *  - caché en memoria (7 días) + caché de fetch de Next;
 *  - User-Agent con contacto (NOMINATIM_EMAIL o la URL pública).
 *
 * Con cualquiera de los dos, un «sin resultados» se cachea, pero un fallo
 * pasajero (timeout, 429, 5xx) no: la siguiente llamada vuelve a intentarlo.
 */

import {
  cachePersistente,
  FalloGeoapify,
  geoapifyConfigurado,
  geoapifyGet,
  parsearGeocodificacion,
} from '@/lib/api/geoapify'
import { getBaseUrl } from '@/lib/utils/baseUrl'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const MIN_GAP_MS = 1100
const TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Vigencia de la caché persistente de Geoapify (segundos). */
const TTL_PERSISTENTE_S = 30 * 24 * 60 * 60

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
  /**
   * Qué se busca. 'lugar' (una actividad o un sitio concreto): con Geoapify
   * se descartan los aciertos de ciudad, región, país o código postal, que
   * Geoapify devuelve como respaldo cuando no encuentra el sitio (Nominatim
   * devuelve vacío). 'zona': una ciudad o un destino. Por defecto 'lugar' si
   * hay `near` y 'zona' si no; quien busca actividades lo pasa siempre, haya
   * ancla o no.
   */
  nivel?: 'lugar' | 'zona'
}

/** ¿La consulta es de un sitio concreto (sin aciertos de ciudad o país)? */
const esNivelLugar = (opts: GeocodeOptions): boolean =>
  opts.nivel ? opts.nivel === 'lugar' : Boolean(opts.near)

/** Resultado de una consulta; solo se cachea si es `definitivo`. */
interface Consulta {
  valor: GeoPoint | null
  /** Respuesta válida del proveedor (con o sin resultado). */
  definitivo: boolean
}

const cache = new Map<string, { at: number; value: GeoPoint | null }>()
/** Consultas en curso, para no repetir una idéntica simultánea. */
const enCurso = new Map<string, Promise<GeoPoint | null>>()
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

/** Caja de `km` alrededor de `near` (grados). */
function caja(
  near: { lat: number; lng: number },
  km: number
): { left: number; top: number; right: number; bottom: number } {
  const dLat = km / 111
  const dLng = km / (111 * Math.max(0.1, Math.cos((near.lat * Math.PI) / 180)))
  return {
    left: near.lng - dLng,
    right: near.lng + dLng,
    top: near.lat + dLat,
    bottom: near.lat - dLat,
  }
}

function viewbox(near: { lat: number; lng: number }, km: number): string {
  const { left, top, right, bottom } = caja(near, km)
  return `${left},${top},${right},${bottom}`
}

// ---------------------------------------------------------------------------
// Nominatim (sin GEOAPIFY_API_KEY)
// ---------------------------------------------------------------------------

async function geocodeNominatim(
  q: string,
  opts: GeocodeOptions
): Promise<Consulta> {
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

  return enCola(async (): Promise<Consulta> => {
    try {
      const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: { 'User-Agent': userAgent(), 'Accept-Language': 'es' },
        next: { revalidate: 60 * 60 * 24 * 7 },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return { valor: null, definitivo: false }
      const data = (await res.json()) as Array<{
        lat: string
        lon: string
        display_name: string
        address?: { country_code?: string }
      }>
      const first = data[0]
      if (!first) return { valor: null, definitivo: true }
      const lat = Number(first.lat)
      const lng = Number(first.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { valor: null, definitivo: true }
      }
      return {
        valor: {
          lat,
          lng,
          displayName: first.display_name,
          ...(first.address?.country_code
            ? { countryCode: first.address.country_code }
            : {}),
        },
        definitivo: true,
      }
    } catch {
      return { valor: null, definitivo: false }
    }
  })
}

// ---------------------------------------------------------------------------
// Geoapify (con GEOAPIFY_API_KEY)
// ---------------------------------------------------------------------------

const lon6 = (v: number): string => Math.min(180, Math.max(-180, v)).toFixed(6)
const lat6 = (v: number): string => Math.min(90, Math.max(-90, v)).toFixed(6)

function parametrosGeoapify(
  q: string,
  opts: GeocodeOptions
): Record<string, string> {
  const params: Record<string, string> = {
    text: q,
    lang: 'es',
    limit: '3',
    format: 'json',
  }
  // Filtros duros (| = Y): la misma caja que el viewbox de Nominatim, en
  // orden lon1,lat1,lon2,lat2 (esquina SO y NE), y los países pedidos.
  const filtros: string[] = []
  if (opts.near) {
    const { left, top, right, bottom } = caja(opts.near, opts.radiusKm ?? 80)
    filtros.push(
      `rect:${lon6(left)},${lat6(bottom)},${lon6(right)},${lat6(top)}`
    )
  }
  const paises = (opts.countryCodes ?? [])
    .map((c) => c.trim().toLowerCase())
    .filter((c) => /^[a-z]{2}$/.test(c))
  if (paises.length) filtros.push(`countrycode:${paises.join(',')}`)
  if (filtros.length) params['filter'] = filtros.join('|')
  // Sesgo siempre explícito: el de por defecto (countrycode:auto) usaría la IP
  // del servidor, no la del viajero.
  params['bias'] = opts.near
    ? `proximity:${lon6(opts.near.lng)},${lat6(opts.near.lat)}`
    : 'countrycode:none'
  return params
}

async function geocodeGeoapify(
  q: string,
  opts: GeocodeOptions
): Promise<Consulta> {
  const texto = q.replace(/\s+/g, ' ')
  const params = parametrosGeoapify(texto, opts)
  // Una actividad no vale un acierto de ciudad (ver GeocodeOptions.nivel).
  const nivelLugar = esNivelLugar(opts)
  // Clave: la consulta normalizada y las opciones tal como se envían.
  const claveCache = JSON.stringify([
    texto.toLowerCase(),
    params['filter'] ?? null,
    params['bias'] ?? null,
    nivelLugar ? 'lugar' : 'zona',
  ])
  const r = await cachePersistente(
    ['geoapify-geocode-v1', claveCache],
    TTL_PERSISTENTE_S,
    async (): Promise<GeoPoint | null> => {
      const res = await geoapifyGet('/geocode/search', params)
      if (!res.ok) throw new FalloGeoapify()
      return parsearGeocodificacion(res.json, { nivelLugar })
    }
  )
  return r.ok
    ? { valor: r.valor, definitivo: true }
    : { valor: null, definitivo: false }
}

// ---------------------------------------------------------------------------

/** Geocodifica `query`. Nunca lanza: si no hay resultado devuelve null. */
export async function geocode(
  query: string,
  opts: GeocodeOptions = {}
): Promise<GeoPoint | null> {
  const q = query.trim()
  if (!q) return null

  const geoapify = geoapifyConfigurado()
  const cacheKey = JSON.stringify([
    q.toLowerCase(),
    opts.near ? [opts.near.lat.toFixed(2), opts.near.lng.toFixed(2)] : null,
    opts.radiusKm ?? null,
    opts.countryCodes ?? null,
  ])
  // Los resultados de cada proveedor se guardan por separado; los de
  // Geoapify dependen además del nivel (con 'lugar' se descartan aciertos).
  const claveMemoria = geoapify
    ? `geoapify:${esNivelLugar(opts) ? 'lugar' : 'zona'}:${cacheKey}`
    : cacheKey
  const hit = cache.get(claveMemoria)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value

  // Una misma consulta simultánea (p. ej. desde las geocodificaciones en
  // paralelo de generateTrips) se resuelve una sola vez.
  const pendiente = enCurso.get(claveMemoria)
  if (pendiente) return pendiente
  const promesa = consultar(q, opts, geoapify, claveMemoria).finally(() =>
    enCurso.delete(claveMemoria)
  )
  enCurso.set(claveMemoria, promesa)
  return promesa
}

async function consultar(
  q: string,
  opts: GeocodeOptions,
  geoapify: boolean,
  claveMemoria: string
): Promise<GeoPoint | null> {
  let consulta: Consulta
  try {
    consulta = geoapify
      ? await geocodeGeoapify(q, opts)
      : await geocodeNominatim(q, opts)
  } catch {
    return null
  }

  // Solo se cachea una respuesta válida (también la vacía), nunca un fallo
  // pasajero: si no, un timeout dejaría el lugar sin pin durante 7 días.
  if (consulta.definitivo) {
    cache.set(claveMemoria, { at: Date.now(), value: consulta.valor })
    if (cache.size > 2000) {
      const masViejo = cache.keys().next().value
      if (masViejo !== undefined) cache.delete(masViejo)
    }
  }
  return consulta.valor
}
