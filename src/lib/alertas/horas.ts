import type { Activity } from '@/types/activity'

/**
 * Horas del modo en vivo de la web, siempre en la zona horaria del
 * navegador. Puras: la hora llega como parámetro.
 */

const HORA_RE = /^(\d{1,2}):(\d{2})/

const dos = (n: number): string => String(n).padStart(2, '0')

/** 'HH:MM' → minutos desde la medianoche, o null si no es válida. */
export function minutosDeHora(hora: string | null | undefined): number | null {
  const m = HORA_RE.exec((hora ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Minutos desde la medianoche de un Date (hora local). */
export function minutosDelDia(fecha: Date): number {
  return fecha.getHours() * 60 + fecha.getMinutes()
}

/** Date → 'YYYY-MM-DD' en hora local. */
export function fechaISO(fecha: Date): string {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`
}

/** Inicio de la actividad en minutos del día (null si no tiene hora). */
export function inicioMin(a: Pick<Activity, 'horaInicio'>): number | null {
  return minutosDeHora(a.horaInicio)
}

/**
 * Fin de la actividad: horaFin si es posterior al inicio; si no, inicio +
 * duración (mínimo 15 min, 60 por defecto). Igual que la vista «Hoy».
 */
export function finMin(
  a: Pick<Activity, 'horaInicio' | 'horaFin' | 'duracionMinutos'>
): number | null {
  const ini = inicioMin(a)
  if (ini === null) return null
  const fin = minutosDeHora(a.horaFin)
  return fin !== null && fin > ini
    ? fin
    : ini + Math.max(15, a.duracionMinutos || 60)
}

/** Copia ordenada por hora de inicio (las que no tienen hora, al final). */
export function ordenarPorHora<T extends Pick<Activity, 'horaInicio'>>(
  actividades: readonly T[]
): T[] {
  return [...actividades].sort((x, y) => {
    const a = inicioMin(x)
    const b = inicioMin(y)
    if (a === null && b === null) return 0
    if (a === null) return 1
    if (b === null) return -1
    return a - b
  })
}
