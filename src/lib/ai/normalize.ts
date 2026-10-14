import type { Activity, ActivityType } from '@/types/activity'
import type { Day } from '@/types/trip'
import { DAY_COLORS } from '@/constants/mapColors'

/**
 * Normalización de la salida de la IA (generación y ajustes).
 *
 * La IA puede omitir campos, mandar números como texto, repetir ids entre días
 * o inventar coordenadas lejísimos del destino. Todo lo que llega del modelo
 * pasa por aquí antes de llegar a la UI o a la base de datos.
 */

export const TIPOS_ACTIVIDAD: readonly ActivityType[] = [
  'museo',
  'restaurante',
  'templo',
  'parque',
  'barrio',
  'playa',
  'actividad',
  'traslado',
] as const

/** Radio de geofencing por tipo (metros), coherente con las reglas del prompt. */
const RADIO_POR_TIPO: Record<ActivityType, number> = {
  restaurante: 80,
  museo: 120,
  templo: 120,
  parque: 250,
  playa: 400,
  barrio: 500,
  actividad: 150,
  traslado: 300,
}

export const num = (v: unknown, fallback = 0): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/[^\d.,-]/g, '').replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return fallback
}

export const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v.trim() : fallback

const strArr = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    : []

/** "9:5" → "09:05"; valores imposibles → null. */
export function normHora(v: unknown): string | null {
  const m = /^(\d{1,2}):(\d{1,2})/.exec(str(v))
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function horaAMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function minAHora(min: number): string {
  const total = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371
  const toRad = (x: number): number => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const coordValida = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180 &&
  !(lat === 0 && lng === 0)

/** Campos de estado/progreso que la IA nunca debe tocar en un ajuste. */
type CamposEstado = Pick<
  Activity,
  | 'estado'
  | 'esPerdida'
  | 'reservaPagada'
  | 'reagendadaDesdeDia'
  | 'puertoCrucero'
  | 'tiempoEmbarqueMinutos'
  | 'coordsVerificadas'
>

export interface NormalizeActivityOptions {
  /** Actividad original (ajustes): se conserva su estado y sus coords si no cambió de lugar. */
  original?: Activity
  /** Ids ya usados en el viaje: si el id choca, se genera uno nuevo. */
  usados?: Set<string>
}

/** Rellena y sanea una actividad que viene de la IA. */
export function normalizeActivity(
  raw: Record<string, unknown>,
  opts: NormalizeActivityOptions = {}
): Activity {
  const { original, usados } = opts
  const tipo = TIPOS_ACTIVIDAD.includes(raw.tipo as ActivityType)
    ? (raw.tipo as ActivityType)
    : (original?.tipo ?? 'actividad')

  let id = str(raw.id) || original?.id || ''
  if (!id || usados?.has(id)) id = crypto.randomUUID()
  usados?.add(id)

  const nombre = str(raw.nombre) || original?.nombre || 'Actividad'
  const horaInicio = normHora(raw.horaInicio) ?? original?.horaInicio ?? '09:00'
  let horaFin = normHora(raw.horaFin) ?? original?.horaFin ?? ''
  let duracion = Math.max(
    0,
    Math.round(num(raw.duracionMinutos, original?.duracionMinutos ?? 0))
  )
  if (!horaFin) horaFin = minAHora(horaAMin(horaInicio) + (duracion || 60))
  if (!duracion) {
    const d = horaAMin(horaFin) - horaAMin(horaInicio)
    duracion = d > 0 ? d : 60
  }

  // Coordenadas: si la IA no movió el lugar, conservamos las verificadas.
  const mismoLugar =
    original && original.nombre.trim().toLowerCase() === nombre.toLowerCase()
  let lat = num(raw.lat, NaN)
  let lng = num(raw.lng, NaN)
  let coordsVerificadas = false
  if (mismoLugar && original && coordValida(original.lat, original.lng)) {
    lat = original.lat
    lng = original.lng
    coordsVerificadas = Boolean(original.coordsVerificadas)
  } else if (!coordValida(lat, lng)) {
    lat = 0
    lng = 0
  }

  const estado: CamposEstado = original
    ? {
        estado: original.estado,
        esPerdida: original.esPerdida,
        reservaPagada: original.reservaPagada,
        ...(original.reagendadaDesdeDia !== undefined
          ? { reagendadaDesdeDia: original.reagendadaDesdeDia }
          : {}),
        ...(original.puertoCrucero !== undefined
          ? { puertoCrucero: original.puertoCrucero }
          : {}),
        ...(original.tiempoEmbarqueMinutos !== undefined
          ? { tiempoEmbarqueMinutos: original.tiempoEmbarqueMinutos }
          : {}),
        coordsVerificadas,
      }
    : {
        estado: 'pendiente',
        esPerdida: false,
        reservaPagada: false,
        coordsVerificadas,
      }

  // Datos de crucero que puede aportar la IA en una generación nueva.
  if (!original) {
    if (typeof raw.puertoCrucero === 'boolean' && raw.puertoCrucero) {
      estado.puertoCrucero = true
      estado.tiempoEmbarqueMinutos =
        Math.round(num(raw.tiempoEmbarqueMinutos, 90)) || 90
    }
  }

  return {
    id,
    nombre,
    descripcion: str(raw.descripcion) || original?.descripcion || '',
    horaInicio,
    horaFin,
    duracionMinutos: duracion,
    tipo,
    direccion:
      str(raw.direccion) || (mismoLugar ? (original?.direccion ?? '') : ''),
    lat,
    lng,
    radioGeofencingMetros:
      Math.round(num(raw.radioGeofencingMetros, 0)) > 0
        ? Math.round(num(raw.radioGeofencingMetros))
        : RADIO_POR_TIPO[tipo],
    precioEstimado: Math.max(
      0,
      Math.round(num(raw.precioEstimado, original?.precioEstimado ?? 0))
    ),
    reservaRequerida:
      typeof raw.reservaRequerida === 'boolean'
        ? raw.reservaRequerida
        : (original?.reservaRequerida ?? false),
    mejorHoraVisita:
      str(raw.mejorHoraVisita) || original?.mejorHoraVisita || '',
    consejos: strArr(raw.consejos).length
      ? strArr(raw.consejos)
      : (original?.consejos ?? []),
    tiempoHastaSiguiente: Math.max(
      0,
      Math.round(
        num(raw.tiempoHastaSiguiente, original?.tiempoHastaSiguiente ?? 0)
      )
    ),
    ...estado,
  }
}

/**
 * Ordena las actividades por hora y resuelve solapes empujando la siguiente
 * actividad al final de la anterior (+ traslado). No toca actividades que
 * cruzan medianoche al final del día.
 */
export function ordenarYDesolapar(acts: Activity[]): Activity[] {
  const orden = [...acts].sort(
    (a, b) => horaAMin(a.horaInicio) - horaAMin(b.horaInicio)
  )
  let finPrev = -1
  return orden.map((a, i) => {
    let ini = horaAMin(a.horaInicio)
    const dur = Math.max(5, a.duracionMinutos)
    const traslado =
      i > 0 ? Math.min(orden[i - 1]?.tiempoHastaSiguiente ?? 0, 90) : 0
    if (finPrev >= 0 && ini < finPrev) {
      ini = finPrev + Math.max(0, traslado)
    }
    const fin = ini + dur
    finPrev = fin
    if (ini === horaAMin(a.horaInicio)) {
      // Solo reescribimos horaFin si era incoherente.
      const finOrig = horaAMin(a.horaFin)
      return finOrig > ini ? a : { ...a, horaFin: minAHora(fin) }
    }
    return { ...a, horaInicio: minAHora(ini), horaFin: minAHora(fin) }
  })
}

/**
 * Pone a 0 las coordenadas que la IA inventó lejos del ancla del día (se
 * geocodificarán en segundo plano). `radioKm` depende del tipo de viaje.
 */
export function descartarCoordsLejanas(
  acts: Activity[],
  ancla: { lat: number; lng: number } | null,
  radioKm: number
): Activity[] {
  if (!ancla || !coordValida(ancla.lat, ancla.lng)) return acts
  return acts.map((a) =>
    coordValida(a.lat, a.lng) &&
    !a.coordsVerificadas &&
    haversineKm(ancla, a) > radioKm
      ? { ...a, lat: 0, lng: 0 }
      : a
  )
}

export interface NormalizeDayOptions {
  original?: Day
  usados?: Set<string>
}

/** Normaliza un día completo (actividades incluidas). */
export function normalizeDay(
  raw: Record<string, unknown>,
  idx: number,
  opts: NormalizeDayOptions = {}
): Day {
  const { original, usados } = opts
  const actividadesRaw = Array.isArray(raw.actividades)
    ? (raw.actividades as Record<string, unknown>[])
    : []
  const porId = new Map((original?.actividades ?? []).map((a) => [a.id, a]))
  const actividades = ordenarYDesolapar(
    actividadesRaw
      .filter((a) => a && typeof a === 'object')
      .map((a) => {
        const orig = typeof a.id === 'string' ? porId.get(a.id) : undefined
        return normalizeActivity(a, {
          ...(orig ? { original: orig } : {}),
          ...(usados ? { usados } : {}),
        })
      })
  )
  const sumaActividades = actividades.reduce((s, a) => s + a.precioEstimado, 0)
  const presupuestoDia = Math.round(num(raw.presupuestoDia, sumaActividades))
  return {
    numero: idx + 1,
    titulo: str(raw.titulo) || original?.titulo || `Día ${idx + 1}`,
    descripcion: str(raw.descripcion) || original?.descripcion || '',
    ciudad: str(raw.ciudad) || original?.ciudad || '',
    presupuestoDia: Math.max(presupuestoDia, 0),
    colorMapa: DAY_COLORS[idx % DAY_COLORS.length] ?? '#2E75B6',
    actividades,
  }
}
