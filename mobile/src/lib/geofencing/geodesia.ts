/**
 * Geometría en la esfera para el mapa en vivo: círculos de geocerca con su
 * radio REAL en metros (no en píxeles), que escalan con el zoom.
 */

const RADIO_TIERRA_M = 6_371_008.8
const rad = (g: number): number => (g * Math.PI) / 180
const grados = (r: number): number => (r * 180) / Math.PI

export type Posicion = [lng: number, lat: number]

/** Punto a `distancia` metros de (lat, lng) con rumbo `rumbo` (grados). */
export function destino(
  lat: number,
  lng: number,
  distancia: number,
  rumbo: number
): Posicion {
  const d = distancia / RADIO_TIERRA_M
  const b = rad(rumbo)
  const p1 = rad(lat)
  const l1 = rad(lng)
  const p2 = Math.asin(
    Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b)
  )
  const l2 =
    l1 +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(p1),
      Math.cos(d) - Math.sin(p1) * Math.sin(p2)
    )
  const lngNorm = ((grados(l2) + 540) % 360) - 180
  return [lngNorm, grados(p2)]
}

/** Anillo cerrado (GeoJSON) de un círculo geodésico de `radioMetros`. */
export function anilloGeodesico(
  lat: number,
  lng: number,
  radioMetros: number,
  pasos = 64
): Posicion[] {
  const radio = Math.max(1, radioMetros)
  const anillo: Posicion[] = []
  for (let i = 0; i < pasos; i++) {
    anillo.push(destino(lat, lng, radio, (i * 360) / pasos))
  }
  const primero = anillo[0]
  if (primero) anillo.push(primero)
  return anillo
}

/** Distancia en metros entre dos puntos (haversine). */
export function distanciaMetros(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return RADIO_TIERRA_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Minutos a pie aproximados (4,8 km/h, con un 25 % extra por calles). */
export function minutosAPie(metros: number): number {
  return Math.max(1, Math.round(((metros * 1.25) / 4800) * 60))
}

export interface Limites {
  ne: Posicion
  sw: Posicion
}

/** Caja que contiene todos los puntos, o null si no hay ninguno. */
export function limitesDe(puntos: Posicion[]): Limites | null {
  if (puntos.length === 0) return null
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  for (const [lng, lat] of puntos) {
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  }
  return { ne: [maxLng, maxLat], sw: [minLng, minLat] }
}
