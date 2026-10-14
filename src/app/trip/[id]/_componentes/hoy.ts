import type { Trip } from '@/types/trip'
import type { Activity } from '@/types/activity'
import { diasHasta } from '@/lib/utils/formatters'
import { horaDeMinutos, minutosDeHora } from '@/components/trip/tripUtils'

/**
 * Cálculos de la vista «Hoy» del viaje en vivo (docs/DISENO.md §6.6). Puros:
 * reciben la hora como parámetro.
 */

export type MomentoViaje = 'antes' | 'durante' | 'despues'

export interface EstadoHoy {
  momento: MomentoViaje
  /** Índice del día de hoy (0 = día 1) si el viaje está en curso. */
  indiceHoy: number | null
  /** Días que faltan para empezar (solo antes del viaje). */
  faltan: number
  actual: Activity | null
  siguiente: Activity | null
  /** 0..1 del tiempo transcurrido de la actividad actual. */
  progreso: number
  /** Minutos hasta que empiece la siguiente. */
  minutosParaSiguiente: number | null
  minutosAhora: number
}

const ocupa = (a: Activity) => a.estado !== 'perdida' && !a.esPerdida

export function calcularHoy(trip: Trip, ahora: Date): EstadoHoy {
  const offset = -diasHasta(trip.fechaInicio, ahora)
  const total = trip.dias.length
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()
  const base: EstadoHoy = {
    momento: offset < 0 ? 'antes' : offset >= total ? 'despues' : 'durante',
    indiceHoy: offset >= 0 && offset < total ? offset : null,
    faltan: offset < 0 ? -offset : 0,
    actual: null,
    siguiente: null,
    progreso: 0,
    minutosParaSiguiente: null,
    minutosAhora,
  }
  if (base.indiceHoy === null) return base
  const dia = trip.dias[base.indiceHoy]
  if (!dia) return base

  const tramos = dia.actividades
    .filter(ocupa)
    .map((a) => {
      const ini = minutosDeHora(a.horaInicio)
      const finLeido = minutosDeHora(a.horaFin)
      if (ini === null) return null
      const fin =
        finLeido === null || finLeido <= ini
          ? ini + Math.max(15, a.duracionMinutos || 60)
          : finLeido
      return { a, ini, fin }
    })
    .filter((t): t is { a: Activity; ini: number; fin: number } => t !== null)
    .sort((x, y) => x.ini - y.ini)

  const actual = tramos.find(
    (t) => t.ini <= minutosAhora && minutosAhora < t.fin
  )
  const siguiente = tramos.find((t) => t.ini > minutosAhora)
  return {
    ...base,
    actual: actual?.a ?? null,
    siguiente: siguiente?.a ?? null,
    progreso: actual
      ? Math.min(
          1,
          Math.max(0, (minutosAhora - actual.ini) / (actual.fin - actual.ini))
        )
      : 0,
    minutosParaSiguiente: siguiente ? siguiente.ini - minutosAhora : null,
  }
}

export interface AlertaEmbarque {
  clave: string
  actividad: Activity
  hora: string
  minutosRestantes: number
}

/**
 * Embarque del crucero: compara la FECHA y la hora. Aparece desde
 * `tiempoEmbarqueMinutos` (90 por defecto) antes de la hora del puerto.
 */
export function calcularEmbarque(
  trip: Trip,
  ahora: Date,
  tripId: string
): AlertaEmbarque | null {
  const offset = -diasHasta(trip.fechaInicio, ahora)
  const dia = trip.dias[offset]
  if (offset < 0 || !dia) return null
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()
  for (const a of dia.actividades) {
    if (!a.puertoCrucero || !ocupa(a)) continue
    const ini = minutosDeHora(a.horaInicio)
    if (ini === null) continue
    const margen =
      a.tiempoEmbarqueMinutos && a.tiempoEmbarqueMinutos > 0
        ? Math.min(240, a.tiempoEmbarqueMinutos)
        : 90
    if (minutosAhora >= ini - margen && minutosAhora < ini) {
      return {
        clave: `${tripId}:${trip.fechaInicio}:${offset}:${a.id}`,
        actividad: a,
        hora: horaDeMinutos(ini),
        minutosRestantes: ini - minutosAhora,
      }
    }
  }
  return null
}
