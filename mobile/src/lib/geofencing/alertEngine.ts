/**
 * Motor de alertas por retraso del modo en vivo (puro, sin efectos).
 *
 * - Solo evalúa las actividades del día de HOY, y solo si hoy cae dentro del
 *   viaje (cada Day lleva su fecha real).
 * - El retraso es lo tarde que vas a la próxima actividad pendiente a la que
 *   aún no has llegado (fecha + hora completas, no solo la hora).
 * - Niveles 1-4 por retraso. El nivel 5 queda reservado al embarque de un
 *   crucero: nunca aparece en un viaje normal.
 */
import type { Activity } from '../../types/activity'
import type { Day } from '../../types/trip'
import type { AlertLevel } from '../../types/alert'
import {
  faseDelViaje,
  finMin,
  inicioMin,
  minutosDelDia,
  ordenarPorHora,
} from './fechas'

/** Antelación por defecto para estar en el puerto (min). */
export const ANTELACION_EMBARQUE_MIN = 90
/** Tope de la antelación (igual que la web: más de 4 h no tiene sentido). */
const ANTELACION_MAX_MIN = 240

/**
 * Minutos antes de la hora del puerto en que aparece el aviso de embarque:
 * los del itinerario (si son > 0, con tope de 240) o 90 por defecto.
 */
export function antelacionEmbarque(a: Activity | undefined): number {
  const t = a?.tiempoEmbarqueMinutos
  return t !== undefined && Number.isFinite(t) && t > 0
    ? Math.min(ANTELACION_MAX_MIN, t)
    : ANTELACION_EMBARQUE_MIN
}

/** Nivel por minutos de retraso (0-4). */
export function nivelPorRetraso(retrasoMinutos: number): AlertLevel {
  if (retrasoMinutos <= 0) return 0
  if (retrasoMinutos <= 15) return 1
  if (retrasoMinutos <= 30) return 2
  if (retrasoMinutos <= 50) return 3
  return 4
}

/**
 * Nivel final. El 5 solo existe en crucero, cuando faltan `antelacion`
 * minutos o menos para la hora de estar en el puerto.
 */
export function calculateAlertLevel(
  retrasoMinutos: number,
  esCrucero: boolean,
  minutosParaEmbarque?: number,
  antelacion: number = ANTELACION_EMBARQUE_MIN
): AlertLevel {
  if (
    esCrucero &&
    minutosParaEmbarque !== undefined &&
    minutosParaEmbarque >= 0 &&
    minutosParaEmbarque <= antelacion
  ) {
    return 5
  }
  return nivelPorRetraso(retrasoMinutos)
}

export interface Embarque {
  /** Actividad del puerto (vuelta al barco). */
  actividadId: string
  nombre: string
  lat: number
  lng: number
  /** Hora 'HH:MM' a la que hay que estar en el puerto. */
  hora: string
  minutosRestantes: number
  /** Fecha ISO del día (para «Ocultar por hoy»). */
  fecha: string
}

export interface EvaluacionAlerta {
  level: AlertLevel
  retrasoMinutos: number
  /** Actividad afectada (la del embarque si level === 5). */
  actividadId: string | null
  embarque: Embarque | null
}

export const SIN_ALERTA: EvaluacionAlerta = {
  level: 0,
  retrasoMinutos: 0,
  actividadId: null,
  embarque: null,
}

export interface HoyEnVivo {
  indice: number
  fecha: string
  actividades: Activity[]
}

/** Actividades de hoy ordenadas por hora, o null si hoy no hay viaje. */
export function actividadesDeHoy(dias: Day[], ahora: Date): HoyEnVivo | null {
  const fase = faseDelViaje(dias, ahora)
  if (fase.tipo !== 'durante') return null
  const dia = dias[fase.indiceHoy]
  if (!dia) return null
  return {
    indice: fase.indiceHoy,
    fecha: fase.fecha,
    actividades: ordenarPorHora(dia.actividades),
  }
}

export type TipoMomento = 'en_curso' | 'ahora' | 'siguiente' | 'terminado'

export interface MomentoDelDia {
  /** Actividad de la tarjeta AHORA (null si el día ya terminó). */
  actual: Activity | null
  tipo: TipoMomento
  /** La siguiente pendiente después de `actual`. */
  siguiente: Activity | null
}

/**
 * Qué toca ahora: la actividad en curso (detectada por el GPS), la que está
 * en su horario, o la próxima pendiente. `actividades` ya ordenadas por hora.
 */
export function momentoDelDia(
  actividades: Activity[],
  ahora: Date
): MomentoDelDia {
  const ahoraMin = minutosDelDia(ahora)
  const pendientes = actividades.filter((a) => a.estado === 'pendiente')
  const despues = (a: Activity): Activity | null => {
    const i = actividades.indexOf(a)
    return (
      actividades.slice(i + 1).find((x) => x.estado === 'pendiente') ?? null
    )
  }

  const enCurso = actividades.find((a) => a.estado === 'en_curso')
  if (enCurso) {
    return { actual: enCurso, tipo: 'en_curso', siguiente: despues(enCurso) }
  }

  const enHorario = pendientes.find((a) => {
    const ini = inicioMin(a)
    const fin = finMin(a)
    return ini !== null && fin !== null && ini <= ahoraMin && ahoraMin < fin
  })
  if (enHorario) {
    return { actual: enHorario, tipo: 'ahora', siguiente: despues(enHorario) }
  }

  const proxima =
    pendientes.find((a) => (inicioMin(a) ?? Infinity) >= ahoraMin) ??
    pendientes[0]
  if (proxima) {
    return { actual: proxima, tipo: 'siguiente', siguiente: despues(proxima) }
  }
  return { actual: null, tipo: 'terminado', siguiente: null }
}

/**
 * Próxima vuelta al barco de hoy: el último tramo de puerto que va después
 * de alguna excursión (el de la mañana, al desembarcar, no cuenta) y al que
 * aún no has llegado.
 */
export function proximoEmbarque(hoy: HoyEnVivo, ahora: Date): Embarque | null {
  const lista = hoy.actividades
  const primeraExcursion = lista.findIndex((a) => a.puertoCrucero !== true)
  if (primeraExcursion === -1) return null
  const ahoraMin = minutosDelDia(ahora)

  for (let i = primeraExcursion + 1; i < lista.length; i++) {
    const a = lista[i]
    if (!a || a.puertoCrucero !== true || a.estado !== 'pendiente') continue
    const ini = inicioMin(a)
    if (ini === null || ini < ahoraMin || !a.horaInicio) continue
    return {
      actividadId: a.id,
      nombre: a.nombre,
      lat: a.lat,
      lng: a.lng,
      hora: a.horaInicio,
      minutosRestantes: ini - ahoraMin,
      fecha: hoy.fecha,
    }
  }
  return null
}

export interface EvaluarAlertasParams {
  dias: Day[]
  ahora: Date
  esCrucero: boolean
  /**
   * Sin ubicación no se sabe si ya llegaste: no se avisa de retrasos (sí del
   * embarque, que depende solo de la hora).
   */
  conUbicacion: boolean
  /** Actividades para las que el viajero eligió «Continuar igual». */
  omitidas?: ReadonlySet<string>
  /** Claves de embarque ocultadas por hoy (`fecha:actividadId`). */
  embarquesOcultos?: ReadonlySet<string>
}

export const claveEmbarque = (e: Embarque): string =>
  `${e.fecha}:${e.actividadId}`

export function evaluarAlertas({
  dias,
  ahora,
  esCrucero,
  conUbicacion,
  omitidas,
  embarquesOcultos,
}: EvaluarAlertasParams): EvaluacionAlerta {
  const hoy = actividadesDeHoy(dias, ahora)
  if (!hoy) return SIN_ALERTA

  if (esCrucero) {
    const embarque = proximoEmbarque(hoy, ahora)
    const antelacion = antelacionEmbarque(
      embarque
        ? hoy.actividades.find((a) => a.id === embarque.actividadId)
        : undefined
    )
    if (
      embarque &&
      !embarquesOcultos?.has(claveEmbarque(embarque)) &&
      calculateAlertLevel(0, true, embarque.minutosRestantes, antelacion) === 5
    ) {
      return {
        level: 5,
        retrasoMinutos: 0,
        actividadId: embarque.actividadId,
        embarque,
      }
    }
  }

  if (!conUbicacion) return SIN_ALERTA

  const ahoraMin = minutosDelDia(ahora)
  const objetivo = hoy.actividades.find(
    (a) =>
      a.estado === 'pendiente' &&
      a.puertoCrucero !== true &&
      inicioMin(a) !== null &&
      !omitidas?.has(a.id)
  )
  if (!objetivo) return SIN_ALERTA

  const inicio = inicioMin(objetivo) ?? ahoraMin
  const retraso = ahoraMin - inicio
  const level = nivelPorRetraso(retraso)
  if (level === 0) return SIN_ALERTA

  return {
    level,
    retrasoMinutos: retraso,
    actividadId: objetivo.id,
    embarque: null,
  }
}
