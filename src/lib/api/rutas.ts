import 'server-only'
import { setMaxListeners } from 'node:events'
import { haversineKm } from '@/lib/ai/normalize'
import { estimarMinutos } from '@/lib/ai/travelTimes'
import {
  cachePersistente,
  FalloGeoapify,
  geoapifyConfigurado,
  geoapifyGet,
  parsearRuta,
  type TramoGeoapify,
} from '@/lib/api/geoapify'
import { getBaseUrl } from '@/lib/utils/baseUrl'

/**
 * Rutas reales por calles entre paradas del itinerario, sobre datos de
 * OpenStreetMap.
 *
 * Con GEOAPIFY_API_KEY usa la API de rutas de Geoapify (lib/api/geoapify.ts),
 * apta para uso comercial: mode=walk o drive, caché por tramo (memoria + caché
 * de datos de Next de 30 días), una petición por racha de los tramos que
 * faltan, rachas en paralelo (su limitador regula el ritmo) con un plazo
 * total de 25 s y, si se pasa, el límite de créditos por IP que fija quien
 * llama (/api/ruta). Sin la clave usa OSRM: por
 * defecto los servidores públicos de FOSSGIS (routing.openstreetmap.de,
 * perfiles a pie y en carro), gratis y sin clave pero con uso justo; para
 * mucho tráfico, un OSRM propio (variables OSRM_FOOT_URL y OSRM_CAR_URL).
 *
 * Modo de cada tramo: a pie si está a ≤ 1,6 km, en carro si está más lejos y
 * «directo» (sin calles: vuelo o mar) si supera 250 km o lo pide el cliente.
 * Si el servicio falla, el tramo vuelve como estimación (fuente 'estimado')
 * y el mapa dibuja un arco: nunca rompe el itinerario.
 */

export type ModoRuta = 'pie' | 'auto' | 'directo'
export type Punto = [number, number] // [lng, lat]

export interface TramoPedido {
  desde: Punto
  hasta: Punto
  /** Fuerza el modo (p. ej. 'directo' para tramos por mar). */
  modo?: ModoRuta
}

export interface TramoRuta {
  coords: Punto[]
  /** Metros. */
  distancia: number
  /** Segundos. */
  duracion: number
  modo: ModoRuta
  fuente: 'osrm' | 'geoapify' | 'estimado'
}

const BASE: Record<'pie' | 'auto', string> = {
  pie:
    process.env['OSRM_FOOT_URL'] ??
    'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  auto:
    process.env['OSRM_CAR_URL'] ??
    'https://routing.openstreetmap.de/routed-car/route/v1/driving',
}

export const KM_MAX_A_PIE = 1.6
const KM_MAX_POR_CALLE = 250
const MAX_PARADAS_POR_CONSULTA = 20
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export function modoPara(desde: Punto, hasta: Punto): ModoRuta {
  const km = haversineKm(
    { lng: desde[0], lat: desde[1] },
    { lng: hasta[0], lat: hasta[1] }
  )
  if (km > KM_MAX_POR_CALLE) return 'directo'
  return km <= KM_MAX_A_PIE ? 'pie' : 'auto'
}

function estimado(t: TramoPedido, modo: ModoRuta = 'directo'): TramoRuta {
  const km = haversineKm(
    { lng: t.desde[0], lat: t.desde[1] },
    { lng: t.hasta[0], lat: t.hasta[1] }
  )
  return {
    coords: [t.desde, t.hasta],
    distancia: Math.round(km * 1000),
    duracion: estimarMinutos(km) * 60,
    modo,
    fuente: 'estimado',
  }
}

const mismoPunto = (a: Punto, b: Punto): boolean =>
  Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6

const cache = new Map<string, { at: number; tramos: TramoRuta[] }>()

function userAgent(): string {
  const contacto = process.env['NOMINATIM_EMAIL'] ?? getBaseUrl()
  return `Wayio/1.0 (planificador de viajes; ${contacto})`
}

/** Una consulta a OSRM con varias paradas seguidas del mismo modo. */
async function consultarOsrm(
  modo: 'pie' | 'auto',
  paradas: Punto[]
): Promise<TramoRuta[] | null> {
  const ruta = paradas
    .map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`)
    .join(';')
  const url = `${BASE[modo]}/${ruta}?overview=false&steps=true&geometries=geojson`
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.tramos
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': userAgent() },
      signal: AbortSignal.timeout(9000),
      next: { revalidate: 60 * 60 * 24 * 7 },
    })
    if (!res.ok) return null
    const j = (await res.json()) as {
      code?: string
      routes?: Array<{
        legs?: Array<{
          distance?: number
          duration?: number
          steps?: Array<{ geometry?: { coordinates?: number[][] } }>
        }>
      }>
    }
    const legs = j.code === 'Ok' ? j.routes?.[0]?.legs : undefined
    if (!legs || legs.length !== paradas.length - 1) return null
    const tramos = legs.map((leg, i): TramoRuta => {
      const coords: Punto[] = []
      for (const paso of leg.steps ?? []) {
        for (const c of paso.geometry?.coordinates ?? []) {
          const p: Punto = [Number(c[0]), Number(c[1])]
          if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue
          const ultimo = coords[coords.length - 1]
          if (!ultimo || !mismoPunto(ultimo, p)) coords.push(p)
        }
      }
      // Une la ruta con el marcador (OSRM la pega a la calle más cercana).
      const desde = paradas[i] as Punto
      const hasta = paradas[i + 1] as Punto
      if (coords.length < 2) return estimado({ desde, hasta }, modo)
      return {
        coords: [desde, ...coords, hasta],
        distancia: Math.round(leg.distance ?? 0),
        duracion: Math.round(leg.duration ?? 0),
        modo,
        fuente: 'osrm',
      }
    })
    cache.set(url, { at: Date.now(), tramos })
    if (cache.size > 500) {
      const viejo = cache.keys().next().value
      if (viejo !== undefined) cache.delete(viejo)
    }
    return tramos
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Geoapify (con GEOAPIFY_API_KEY): caché por tramo
// ---------------------------------------------------------------------------

const MODO_GEOAPIFY = { pie: 'walk', auto: 'drive' } as const
/** Plazo total de una llamada a calcularRutas con Geoapify. */
const PLAZO_GEOAPIFY_MS = 25_000
/** Cada tramo guardado se vuelve a pedir pasado este periodo. */
const PERIODO_PERSISTENTE_MS = 30 * 24 * 60 * 60 * 1000

/** Geoapify pide lat,lon (al revés que OSRM), con 6 decimales. */
const latLon = (p: Punto): string => `${p[1].toFixed(6)},${p[0].toFixed(6)}`

/** Clave de un tramo: modo + desde + hasta (lat,lon con 6 decimales). */
const claveTramo = (modo: 'pie' | 'auto', t: TramoPedido): string =>
  `${modo}|${latLon(t.desde)}|${latLon(t.hasta)}`

/**
 * Clave en la caché de datos de Next. La caducidad va en la propia clave (un
 * periodo de 30 días, desfasado por tramo para que no caduquen todos a la
 * vez) y no en `revalidate`: con `revalidate`, Next recalcula en segundo
 * plano las entradas vencidas, y la consulta de solo lectura lanzaría.
 */
function clavePersistente(clave: string): string[] {
  let h = 0
  for (const ch of clave) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const periodo = Math.floor(
    (Date.now() + (h % PERIODO_PERSISTENTE_MS)) / PERIODO_PERSISTENTE_MS
  )
  return ['geoapify-tramo-v1', String(periodo), clave]
}

const esTramoGeoapify = (v: unknown): v is TramoGeoapify => {
  if (typeof v !== 'object' || v === null) return false
  const t = v as Partial<Record<keyof TramoGeoapify, unknown>>
  return (
    Array.isArray(t.coords) &&
    t.coords.length >= 2 &&
    typeof t.distancia === 'number' &&
    Number.isFinite(t.distancia) &&
    typeof t.duracion === 'number' &&
    Number.isFinite(t.duracion)
  )
}

const cacheTramos = new Map<string, { at: number; leg: TramoGeoapify }>()

function recordar(clave: string, leg: TramoGeoapify): void {
  cacheTramos.delete(clave)
  cacheTramos.set(clave, { at: Date.now(), leg })
  if (cacheTramos.size > 2000) {
    const viejo = cacheTramos.keys().next().value
    if (viejo !== undefined) cacheTramos.delete(viejo)
  }
}

/** Solo lee la caché persistente: un fallo (no guardado) si no está. */
async function leerPersistente(clave: string): Promise<TramoGeoapify | null> {
  const r = await cachePersistente<TramoGeoapify>(
    clavePersistente(clave),
    false,
    async () => {
      throw new FalloGeoapify()
    }
  )
  return r.ok && esTramoGeoapify(r.valor) ? r.valor : null
}

async function guardarPersistente(
  clave: string,
  leg: TramoGeoapify
): Promise<void> {
  await cachePersistente(clavePersistente(clave), false, async () => leg)
}

/** Una petición a Geoapify con varias paradas seguidas del mismo modo. */
async function consultarGeoapify(
  modo: 'pie' | 'auto',
  paradas: Punto[],
  signal: AbortSignal
): Promise<TramoGeoapify[] | null> {
  const res = await geoapifyGet(
    '/routing',
    { waypoints: paradas.map(latLon).join('|'), mode: MODO_GEOAPIFY[modo] },
    { creditos: paradas.length - 1, signal }
  )
  return res.ok ? parsearRuta(res.json, paradas.length) : null
}

export interface OpcionesRutas {
  /** Si el cliente se va, no se lanzan las peticiones que esperan turno. */
  signal?: AbortSignal
  /**
   * Antes de cada petición a Geoapify: ¿se pueden gastar estos créditos? (el
   * límite por IP de /api/ruta). Si no, esa racha sale estimada.
   */
  autorizarCreditos?: (creditos: number) => Promise<boolean>
}

/**
 * Geoapify cobra un crédito por tramo se agrupe como se agrupe, así que cada
 * tramo se guarda con su propia clave: primero se miran la memoria y la caché
 * persistente tramo a tramo y solo los que faltan forman rachas (agruparlas
 * ahorra peticiones, no créditos). Las rachas van en paralelo: el limitador
 * de geoapify.ts regula el ritmo y el plazo total corta lo que no llegue.
 */
async function rutasGeoapify(
  tramos: TramoPedido[],
  modos: ModoRuta[],
  opciones: OpcionesRutas
): Promise<(TramoGeoapify | null)[]> {
  const plazo = AbortSignal.timeout(PLAZO_GEOAPIFY_MS)
  const signal = opciones.signal
    ? AbortSignal.any([opciones.signal, plazo])
    : plazo
  // Cada racha en cola y cada petición escuchan esta señal (hasta 80).
  setMaxListeners(0, signal)
  const claves = tramos.map((t, i) => {
    const modo = modos[i]
    return modo === 'pie' || modo === 'auto' ? claveTramo(modo, t) : null
  })
  const legs = new Array<TramoGeoapify | null>(tramos.length).fill(null)

  // 1) Memoria de esta instancia.
  const ahora = Date.now()
  claves.forEach((c, i) => {
    const hit = c ? cacheTramos.get(c) : undefined
    if (hit && ahora - hit.at < TTL_MS) legs[i] = hit.leg
  })

  // 2) Caché persistente, en paralelo y sin llamar a Geoapify.
  await Promise.all(
    claves.map(async (c, i) => {
      if (!c || legs[i]) return
      const leg = await leerPersistente(c).catch(() => null)
      if (!leg) return
      legs[i] = leg
      recordar(c, leg)
    })
  )

  // 3) Rachas solo con los tramos que faltan.
  const rachas = agrupar(tramos, modos, (i) => claves[i] !== null && !legs[i])
  await Promise.all(
    rachas.map(async (r) => {
      try {
        const creditos = r.paradas.length - 1
        if (signal.aborted) return
        if (
          opciones.autorizarCreditos &&
          !(await opciones.autorizarCreditos(creditos))
        ) {
          return
        }
        const res = await consultarGeoapify(r.modo, r.paradas, signal)
        if (!res || res.length !== creditos) return
        const guardados: Promise<void>[] = []
        res.forEach((leg, k) => {
          const i = r.inicio + k
          const c = claves[i]
          if (!c || !esTramoGeoapify(leg)) return
          legs[i] = leg
          recordar(c, leg)
          guardados.push(guardarPersistente(c, leg).catch(() => undefined))
        })
        await Promise.all(guardados)
      } catch {
        // Esa racha sale estimada.
      }
    })
  )
  return legs
}

// ---------------------------------------------------------------------------

/** Tramos encadenados del mismo modo que van en una sola consulta. */
interface Racha {
  inicio: number
  /** Índice siguiente al último tramo de la racha. */
  fin: number
  modo: 'pie' | 'auto'
  paradas: Punto[]
}

/**
 * Agrupa en rachas los tramos encadenados del mismo modo (máximo
 * MAX_PARADAS_POR_CONSULTA tramos cada una). Solo entran los tramos que no
 * son 'directo' y cumplen `incluir`.
 */
function agrupar(
  tramos: TramoPedido[],
  modos: ModoRuta[],
  incluir: (i: number) => boolean
): Racha[] {
  const rachas: Racha[] = []
  let i = 0
  while (i < tramos.length) {
    const modo = modos[i]
    const t = tramos[i] as TramoPedido
    if (modo === undefined || modo === 'directo' || !incluir(i)) {
      i++
      continue
    }
    const inicio = i
    const paradas: Punto[] = [t.desde, t.hasta]
    i++
    while (
      i < tramos.length &&
      incluir(i) &&
      modos[i] === modo &&
      i - inicio < MAX_PARADAS_POR_CONSULTA &&
      mismoPunto(
        (tramos[i - 1] as TramoPedido).hasta,
        (tramos[i] as TramoPedido).desde
      )
    ) {
      paradas.push((tramos[i] as TramoPedido).hasta)
      i++
    }
    rachas.push({ inicio, fin: i, modo, paradas })
  }
  return rachas
}

/**
 * Calcula las rutas de una lista de tramos (mismo largo y orden). Nunca
 * lanza por el proveedor: lo que no llegue sale como estimación.
 */
export async function calcularRutas(
  tramos: TramoPedido[],
  opciones: OpcionesRutas = {}
): Promise<TramoRuta[]> {
  const modos = tramos.map((t) => t.modo ?? modoPara(t.desde, t.hasta))
  const salida = new Array<TramoRuta | undefined>(tramos.length)
  modos.forEach((modo, i) => {
    if (modo === 'directo') salida[i] = estimado(tramos[i] as TramoPedido)
  })

  if (geoapifyConfigurado()) {
    const legs = await rutasGeoapify(tramos, modos, opciones)
    tramos.forEach((t, i) => {
      const modo = modos[i] as ModoRuta
      if (modo === 'directo') return
      const leg = legs[i]
      // Une la ruta con el marcador (Geoapify la pega a la calle más cercana).
      salida[i] = leg
        ? {
            coords: [t.desde, ...leg.coords, t.hasta],
            distancia: Math.round(leg.distancia),
            duracion: Math.round(leg.duracion),
            modo,
            fuente: 'geoapify',
          }
        : estimado(t, modo)
    })
  } else {
    // OSRM público: en serie, como pide su uso justo.
    for (const r of agrupar(tramos, modos, () => true)) {
      const res = await consultarOsrm(r.modo, r.paradas)
      for (let k = r.inicio; k < r.fin; k++) {
        salida[k] =
          res?.[k - r.inicio] ?? estimado(tramos[k] as TramoPedido, r.modo)
      }
    }
  }
  return salida.map((r, k) => r ?? estimado(tramos[k] as TramoPedido))
}
