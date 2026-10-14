/**
 * Fechas y horas del modo en vivo, siempre en la zona horaria del teléfono.
 *
 * Cada `Day.fecha` del modelo en vivo es la fecha real del día en formato
 * 'YYYY-MM-DD' (o '' si el día cae fuera de [fechaInicio, fechaFin]). Las
 * alertas, el geofencing y la tarea en segundo plano solo trabajan con las
 * actividades del día de HOY: nunca se compara solo la hora.
 */
import type { Activity } from '../../types/activity'
import type { Day, Trip } from '../../types/trip'

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/
const HORA_RE = /^(\d{1,2}):(\d{2})$/
const MS_DIA = 86_400_000

const dos = (n: number): string => String(n).padStart(2, '0')

/** 'YYYY-MM-DD…' → Date a medianoche local, o null si no es una fecha válida. */
export function fechaLocal(iso: string | null | undefined): Date | null {
  const m = ISO_RE.exec((iso ?? '').trim())
  if (!m) return null
  const y = Number(m[1])
  const mes = Number(m[2])
  const d = Number(m[3])
  const fecha = new Date(y, mes - 1, d)
  if (
    Number.isNaN(fecha.getTime()) ||
    fecha.getFullYear() !== y ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== d
  ) {
    return null
  }
  return fecha
}

/** Date → 'YYYY-MM-DD' en hora local. */
export function aISO(fecha: Date): string {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`
}

/** Suma `n` días de calendario a una fecha ISO. */
export function sumarDias(iso: string, n: number): string | null {
  const base = fechaLocal(iso)
  if (!base) return null
  return aISO(new Date(base.getFullYear(), base.getMonth(), base.getDate() + n))
}

/** Días de calendario entre dos fechas (b - a). */
export function diasEntre(a: Date, b: Date): number {
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.round((b0 - a0) / MS_DIA)
}

/** 'HH:MM' → minutos desde medianoche, o null. */
export function minutosDeHora(hora: string | null | undefined): number | null {
  const m = HORA_RE.exec((hora ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Minutos desde medianoche → 'HH:MM' (acotado al día). */
export function horaDeMinutos(minutos: number): string {
  const total = Math.min(Math.max(Math.round(minutos), 0), 23 * 60 + 59)
  return `${dos(Math.floor(total / 60))}:${dos(total % 60)}`
}

/** Minutos desde medianoche de un Date. */
export function minutosDelDia(fecha: Date): number {
  return fecha.getHours() * 60 + fecha.getMinutes()
}

/** Fecha ISO + 'HH:MM' → Date local completo. */
export function fechaYHora(iso: string, hora: string | undefined): Date | null {
  const base = fechaLocal(iso)
  const min = minutosDeHora(hora)
  if (!base || min === null) return null
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    Math.floor(min / 60),
    min % 60
  )
}

/** Inicio de la actividad en minutos del día (o null si no tiene hora). */
export function inicioMin(a: Activity): number | null {
  return minutosDeHora(a.horaInicio)
}

/** Fin de la actividad: horaFin, o inicio + duración. */
export function finMin(a: Activity): number | null {
  const fin = minutosDeHora(a.horaFin)
  if (fin !== null) return fin
  const ini = inicioMin(a)
  return ini === null ? null : ini + Math.max(0, a.duracionMinutos)
}

/** Copia de las actividades ordenadas por hora de inicio (las sin hora, al final). */
export function ordenarPorHora<T extends Activity>(actividades: T[]): T[] {
  return [...actividades].sort((x, y) => {
    const a = inicioMin(x)
    const b = inicioMin(y)
    if (a === null && b === null) return 0
    if (a === null) return 1
    if (b === null) return -1
    return a - b
  })
}

/** Fecha ISO real del día, o null si el día no tiene fecha. */
export function fechaDeDia(dia: Day): string | null {
  const m = ISO_RE.exec(dia.fecha ?? '')
  return m ? m[0] : null
}

/**
 * Pone en cada día su fecha real (fechaInicio + índice), sin pasar de
 * fechaFin. Si el día ya trae una fecha ISO, se respeta.
 */
export function conFechasReales(
  trip: Trip,
  fechaInicio: string,
  fechaFin: string
): Trip {
  const fin = fechaLocal(fechaFin)
  return {
    ...trip,
    dias: trip.dias.map((dia, i) => {
      if (fechaDeDia(dia)) return dia
      const iso = sumarDias(fechaInicio, i)
      const fecha = iso ? fechaLocal(iso) : null
      const dentro = fecha !== null && (fin === null || fecha <= fin)
      return { ...dia, fecha: dentro && iso ? iso : '' }
    }),
  }
}

export type FaseViaje =
  | { tipo: 'antes'; faltan: number; inicio: string }
  | { tipo: 'durante'; indiceHoy: number; fecha: string }
  | { tipo: 'despues'; fin: string }
  | { tipo: 'sin_fechas' }

/** En qué punto del viaje estamos hoy. */
export function faseDelViaje(dias: Day[], ahora: Date): FaseViaje {
  const fechas = dias.map(fechaDeDia)
  const validas = fechas.filter((f): f is string => f !== null)
  if (validas.length === 0) return { tipo: 'sin_fechas' }

  const hoy = aISO(ahora)
  const indiceHoy = fechas.indexOf(hoy)
  if (indiceHoy !== -1) return { tipo: 'durante', indiceHoy, fecha: hoy }

  const primera = [...validas].sort()[0]
  const ultima = [...validas].sort().at(-1)
  if (primera && primera > hoy) {
    const inicio = fechaLocal(primera)
    return {
      tipo: 'antes',
      faltan: inicio ? Math.max(1, diasEntre(ahora, inicio)) : 1,
      inicio: primera,
    }
  }
  return { tipo: 'despues', fin: ultima ?? hoy }
}

/** Índice del día de hoy si el viaje está en curso; si no, null. */
export function diaDeHoy(dias: Day[], ahora: Date): number | null {
  const fase = faseDelViaje(dias, ahora)
  return fase.tipo === 'durante' ? fase.indiceHoy : null
}
