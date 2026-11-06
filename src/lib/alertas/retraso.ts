import type { Activity } from '@/types/activity'
import { pendienteEnItinerario, type Llegadas } from './geocercas'
import { finMin, inicioMin, ordenarPorHora } from './horas'

/**
 * Alertas de demora por niveles en la web (puro, sin efectos). Porta el
 * motor de la app (mobile/src/lib/geofencing/alertEngine.ts):
 *
 * - El retraso es lo tarde que vas a la próxima actividad de hoy pendiente a
 *   la que aún no has llegado, comparando con su hora de inicio.
 * - Niveles 1-4 por minutos de retraso (los mismos umbrales que la app). El
 *   5 (embarque del crucero) lo pinta ya VistaViaje: aquí no se calcula y los
 *   tramos de puerto no cuentan como retraso.
 * - «Continuar igual» (omitidas) deja de avisar de esa actividad hoy.
 *
 * Lo propio de la web: el navegador no vigila en segundo plano, así que solo
 * se sabe si llegaste desde que el GPS dio la primera posición de esta
 * visita (`vigiladoDesdeMin`). Lo que terminó antes no genera alertas: abrir
 * la página a las 15:00 no avisa de «360 min tarde» al museo de las 9:00.
 */

export type NivelRetraso = 0 | 1 | 2 | 3 | 4

/** Nivel por minutos de retraso (0-4), como la app. */
export function nivelPorRetraso(retrasoMinutos: number): NivelRetraso {
  if (retrasoMinutos <= 0) return 0
  if (retrasoMinutos <= 15) return 1
  if (retrasoMinutos <= 30) return 2
  if (retrasoMinutos <= 50) return 3
  return 4
}

export interface EvaluacionRetraso {
  nivel: NivelRetraso
  retrasoMinutos: number
  /** Actividad a la que vas tarde (null si no hay alerta). */
  actividad: Activity | null
}

export const SIN_RETRASO: EvaluacionRetraso = {
  nivel: 0,
  retrasoMinutos: 0,
  actividad: null,
}

/** Pendiente HOY: sin hacer en el itinerario y sin llegada detectada. */
export function pendienteHoy(a: Activity, llegadas: Llegadas): boolean {
  return pendienteEnItinerario(a) && llegadas[a.id] === undefined
}

export interface EvaluarRetrasoParams {
  /** Actividades del día de hoy. */
  actividades: readonly Activity[]
  /** Minuto del día actual. */
  ahoraMin: number
  llegadas: Llegadas
  /** Actividades para las que el viajero eligió «Seguir igual». */
  omitidas: ReadonlySet<string>
  /** Minuto del día de la primera posición del GPS en esta visita. */
  vigiladoDesdeMin: number
}

export function evaluarRetraso({
  actividades,
  ahoraMin,
  llegadas,
  omitidas,
  vigiladoDesdeMin,
}: EvaluarRetrasoParams): EvaluacionRetraso {
  const objetivo = ordenarPorHora(actividades).find((a) => {
    if (!pendienteHoy(a, llegadas) || a.puertoCrucero === true) return false
    if (omitidas.has(a.id)) return false
    const fin = finMin(a)
    return fin !== null && fin >= vigiladoDesdeMin
  })
  if (!objetivo) return SIN_RETRASO

  const inicio = inicioMin(objetivo) ?? ahoraMin
  const retraso = ahoraMin - inicio
  const nivel = nivelPorRetraso(retraso)
  if (nivel === 0) return SIN_RETRASO
  return { nivel, retrasoMinutos: retraso, actividad: objetivo }
}

/** Clave de una alerta: lo descartado no vuelve (misma actividad y nivel). */
export function claveRetraso(actividadId: string, nivel: NivelRetraso): string {
  return `${actividadId}:${nivel}`
}

/**
 * Lo que queda hoy después de la actividad con retraso, en orden (para que
 * la IA proponga qué mover).
 */
export function restantesTrasActividad(
  actividades: readonly Activity[],
  actividad: Activity,
  llegadas: Llegadas
): Activity[] {
  const desde = inicioMin(actividad) ?? 0
  return ordenarPorHora(actividades).filter(
    (a) =>
      a.id !== actividad.id &&
      pendienteHoy(a, llegadas) &&
      (inicioMin(a) ?? Number.POSITIVE_INFINITY) >= desde
  )
}
