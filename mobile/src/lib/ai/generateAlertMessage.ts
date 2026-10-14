import { postJSON } from '../api/http'
import type { Activity } from '../../types/activity'
import type { AlertLevel, AlertMessage } from '../../types/alert'

/**
 * Pide al backend un mensaje amable para un retraso. El prompt se construye en
 * el servidor: aquí solo se envían datos estructurados (y el Bearer de la
 * sesión). Si la IA no está disponible el backend devuelve igualmente un
 * mensaje útil; solo falla por red, sesión caducada o límite de uso
 * (BackendError con mensaje en español).
 */

const MAX_SIGUIENTES = 5

const recortar = (s: string | undefined, max: number): string =>
  (s ?? '').trim().slice(0, max)

const hora = (s: string | undefined): string | undefined =>
  s && /^\d{1,2}:\d{2}$/.test(s.trim()) ? s.trim() : undefined

export interface AlertMessageOptions {
  /** Nivel de alerta actual (1-5). Por defecto 3. */
  nivel?: Exclude<AlertLevel, 0>
  /** Si el viaje es un crucero (prioriza volver al barco). */
  esCrucero?: boolean
}

export interface AlertMessageResult extends AlertMessage {
  /** 'ia' si lo generó la IA, 'local' si es el mensaje de respaldo. */
  fuente?: 'ia' | 'local'
}

export async function generateAlertMessage(
  actividad: Activity,
  itinerarioRestante: Activity[],
  retrasoMinutos: number,
  opciones: AlertMessageOptions = {}
): Promise<AlertMessageResult> {
  const siguientes = itinerarioRestante
    .filter((a) => a.id !== actividad.id)
    .slice(0, MAX_SIGUIENTES)
    .map((a) => {
      const horaInicio = hora(a.horaInicio)
      return {
        id: recortar(a.id, 120),
        nombre: recortar(a.nombre, 120) || 'Actividad',
        ...(horaInicio ? { horaInicio } : {}),
        ...(a.duracionMinutos > 0
          ? { duracionMinutos: Math.min(Math.round(a.duracionMinutos), 1440) }
          : {}),
        reservada: Boolean(a.tieneReserva),
        ...(a.votosPositivos
          ? { votosPositivos: Math.min(Math.round(a.votosPositivos), 1000) }
          : {}),
      }
    })

  const horaInicio = hora(actividad.horaInicio)
  const horaFin = hora(actividad.horaFin)
  const esCrucero =
    opciones.esCrucero ??
    [actividad, ...itinerarioRestante].some((a) => a.puertoCrucero === true)

  return postJSON<AlertMessageResult>('/api/alert-message', {
    actividad: {
      id: recortar(actividad.id, 120),
      nombre: recortar(actividad.nombre, 120) || 'Actividad',
      ...(horaInicio ? { horaInicio } : {}),
      ...(horaFin ? { horaFin } : {}),
      tipo: recortar(actividad.tipo, 40),
    },
    retrasoMinutos: Math.min(Math.max(Math.round(retrasoMinutos), 0), 1440),
    nivel: opciones.nivel ?? 3,
    siguientes,
    esCrucero,
    idioma: 'es',
  })
}
