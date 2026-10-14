import 'server-only'
import { haversineKm } from '@/lib/ai/normalize'
import { estimarMinutos } from '@/lib/ai/travelTimes'
import { getBaseUrl } from '@/lib/utils/baseUrl'

/**
 * Rutas reales por calles entre paradas del itinerario (OSRM sobre datos de
 * OpenStreetMap). Por defecto usa los servidores públicos de FOSSGIS
 * (routing.openstreetmap.de, perfiles a pie y en carro), gratis y sin clave
 * pero con uso justo: para mucho tráfico conviene un OSRM propio (variables
 * OSRM_FOOT_URL y OSRM_CAR_URL) o un proveedor comercial.
 *
 * Modo de cada tramo: a pie si está a ≤ 1,6 km, en carro si está más lejos y
 * «directo» (sin calles: vuelo o mar) si supera 250 km o lo pide el cliente.
 * Si el servicio falla, el tramo vuelve como «directo» con una estimación y
 * el mapa dibuja un arco: nunca rompe el itinerario.
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
  fuente: 'osrm' | 'estimado'
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

/**
 * Calcula las rutas de una lista de tramos. Agrupa los tramos encadenados del
 * mismo modo en una sola consulta (menos peticiones al servicio público).
 */
export async function calcularRutas(
  tramos: TramoPedido[]
): Promise<TramoRuta[]> {
  const modos = tramos.map((t) => t.modo ?? modoPara(t.desde, t.hasta))
  const salida = new Array<TramoRuta | undefined>(tramos.length)

  let i = 0
  while (i < tramos.length) {
    const modo = modos[i] as ModoRuta
    const t = tramos[i] as TramoPedido
    if (modo === 'directo') {
      salida[i] = estimado(t)
      i++
      continue
    }
    // Racha de tramos encadenados del mismo modo.
    const inicio = i
    const paradas: Punto[] = [t.desde, t.hasta]
    i++
    while (
      i < tramos.length &&
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
    const res = await consultarOsrm(modo, paradas)
    for (let k = inicio; k < i; k++) {
      salida[k] = res?.[k - inicio] ?? estimado(tramos[k] as TramoPedido, modo)
    }
  }
  return salida.map((r, k) => r ?? estimado(tramos[k] as TramoPedido))
}
