import type { Activity, ActivityType } from '@/types/activity'
import type { UserLocation } from '@/types/geofencing'
import { inicioMin, minutosDelDia } from './horas'

/**
 * Llegadas a cada parada del día (geocercas) en la web, en primer plano.
 * Puras: el hook useAlertasViaje las usa con cada posición del GPS.
 *
 * Igual que la app (mobile/src/lib/geofencing/detector.ts): entrar en el
 * radio de una actividad pendiente la marca «en curso» y salir de él, ya
 * terminada. Lo propio de la web:
 * - Con una lectura del GPS poco precisa (más que el radio, o que 150 m) no
 *   se decide nada: el navegador de un portátil puede ubicar por wifi a
 *   cientos de metros.
 * - Llegar más de 2 h antes de la hora no cuenta: pasar por delante del
 *   restaurante de la cena a media mañana no lo marca.
 * - La salida se confirma con un margen (histéresis), para que el temblor
 *   del GPS en el borde no la dé por terminada al llegar.
 */

/** Radios por tipo de lugar: los mismos que la app (geofencingRadii.ts). */
export const RADIOS_GEOCERCA = {
  restaurante: 80,
  cafe: 60,
  museo: 150,
  templo: 120,
  mirador: 100,
  parque: 250,
  jardin: 200,
  playa: 400,
  barrio: 500,
  mercado: 200,
  plaza: 150,
  aeropuerto: 600,
  puerto_crucero: 800,
  hotel: 100,
  defecto: 150,
} as const satisfies Record<string, number>

const RADIO_POR_TIPO: Partial<Record<ActivityType, number>> = {
  restaurante: RADIOS_GEOCERCA.restaurante,
  museo: RADIOS_GEOCERCA.museo,
  templo: RADIOS_GEOCERCA.templo,
  parque: RADIOS_GEOCERCA.parque,
  playa: RADIOS_GEOCERCA.playa,
  barrio: RADIOS_GEOCERCA.barrio,
}

/** Un radio absurdo (el esquema admite hasta 100 km) no puede marcar llegadas desde lejos. */
export const RADIO_MIN_M = 30
export const RADIO_MAX_M = 1000
/** Precisión mínima exigida a la lectura del GPS (o el radio, si es mayor). */
export const PRECISION_MIN_M = 150
/** Antelación máxima con la que una llegada cuenta (minutos). */
export const ANTELACION_LLEGADA_MIN = 120

export type EstadoLlegada = 'en_curso' | 'completada'
export type Llegadas = Readonly<Record<string, EstadoLlegada>>

export interface CambioLlegada {
  actividadId: string
  nombre: string
  tipo: 'llegada' | 'salida'
  /** ms de la lectura del GPS que lo detectó. */
  momento: number
}

type Lugar = Pick<Activity, 'radioGeofencingMetros' | 'tipo' | 'puertoCrucero'>

/** Radio de la geocerca: el de la actividad o, si no trae, el de su tipo. */
export function radioDe(a: Lugar): number {
  const propio = a.radioGeofencingMetros
  const base =
    Number.isFinite(propio) && propio > 0
      ? propio
      : a.puertoCrucero
        ? RADIOS_GEOCERCA.puerto_crucero
        : (RADIO_POR_TIPO[a.tipo] ?? RADIOS_GEOCERCA.defecto)
  return Math.min(RADIO_MAX_M, Math.max(RADIO_MIN_M, Math.round(base)))
}

/** ¿Tiene coordenadas utilizables? (0,0 = sin ubicar). */
export function conCoords(a: Pick<Activity, 'lat' | 'lng'>): boolean {
  return (
    Number.isFinite(a.lat) &&
    Number.isFinite(a.lng) &&
    !(a.lat === 0 && a.lng === 0)
  )
}

/** Distancia en metros (haversine). */
export function distanciaMetros(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6_371_000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Margen para dar por terminada una actividad al salir de su radio. */
export function margenSalida(radio: number): number {
  return Math.max(25, radio * 0.2)
}

/**
 * ¿La lectura sirve para saber si llegaste? Con una peor que 150 m (wifi
 * de un portátil, ubicación por IP) no se vigilan las demoras: no se sabe si
 * ya estás en el sitio. Sin dato de precisión se da por buena.
 */
export function lecturaPrecisa(precision: number): boolean {
  if (Number.isNaN(precision) || precision <= 0) return true
  return precision <= PRECISION_MIN_M
}

/** Pendiente según el itinerario guardado (no perdida ni ya hecha). */
export function pendienteEnItinerario(
  a: Pick<Activity, 'estado' | 'esPerdida'>
): boolean {
  return (a.estado === 'pendiente' || a.estado === 'recuperada') && !a.esPerdida
}

export interface ResultadoLlegadas {
  /** Mismo objeto que se recibió si no hubo cambios. */
  llegadas: Llegadas
  cambios: CambioLlegada[]
}

/**
 * Evalúa una posición contra las actividades de HOY. Solo las de hoy: pasar
 * por delante del museo del día 3 no lo marca.
 */
export function evaluarLlegadas(
  actividades: readonly Activity[],
  posicion: Pick<UserLocation, 'lat' | 'lng' | 'accuracy'>,
  momento: number,
  llegadas: Llegadas
): ResultadoLlegadas {
  const ahoraMin = minutosDelDia(new Date(momento))
  const precision =
    Number.isFinite(posicion.accuracy) && posicion.accuracy > 0
      ? posicion.accuracy
      : 0
  let nuevas: Record<string, EstadoLlegada> | null = null
  const cambios: CambioLlegada[] = []

  for (const a of actividades) {
    if (!conCoords(a) || a.estado === 'perdida' || a.esPerdida) continue
    const radio = radioDe(a)
    if (precision > Math.max(radio, PRECISION_MIN_M)) continue
    const distancia = distanciaMetros(posicion, a)
    const previo = llegadas[a.id]

    if (previo === undefined) {
      if (!pendienteEnItinerario(a) || distancia > radio) continue
      const ini = inicioMin(a)
      if (ini !== null && ahoraMin < ini - ANTELACION_LLEGADA_MIN) continue
      nuevas ??= { ...llegadas }
      nuevas[a.id] = 'en_curso'
      cambios.push({
        actividadId: a.id,
        nombre: a.nombre,
        tipo: 'llegada',
        momento,
      })
    } else if (
      previo === 'en_curso' &&
      distancia > radio + margenSalida(radio)
    ) {
      nuevas ??= { ...llegadas }
      nuevas[a.id] = 'completada'
      cambios.push({
        actividadId: a.id,
        nombre: a.nombre,
        tipo: 'salida',
        momento,
      })
    }
  }

  return nuevas ? { llegadas: nuevas, cambios } : { llegadas, cambios }
}
