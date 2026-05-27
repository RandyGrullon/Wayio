import { useReducer, useEffect, useCallback } from 'react'
import * as Notifications from 'expo-notifications'
import {
  calculateAlertLevel,
  calcularRetrasoMinutos,
  minutosParaEmbarque,
} from '../lib/geofencing/alertEngine'
import { generateAlertMessage } from '../lib/ai/generateAlertMessage'
import { triggerAlertHaptic } from '../lib/haptics/patterns'
import type { Activity } from '../types/activity'
import type { Day } from '../types/trip'
import type { AlertLevel, AlertState, AlertMessage } from '../types/alert'

const POLL_INTERVAL_MS = 30_000

type Action =
  | {
      type: 'UPDATE'
      level: AlertLevel
      retrasoMinutos: number
      actividadActualId: string | null
    }
  | { type: 'AI_LOADING' }
  | {
      type: 'AI_DONE'
      message: AlertMessage
    }
  | { type: 'DISMISS' }
  | { type: 'RESET' }

const initial: AlertState = {
  level: 0,
  retrasoMinutos: 0,
  actividadActualId: null,
  aiMessage: null,
  aiLoading: false,
  dismissed: false,
  lastUpdated: 0,
}

function reducer(state: AlertState, action: Action): AlertState {
  switch (action.type) {
    case 'UPDATE': {
      const levelChanged = action.level !== state.level
      return {
        ...state,
        level: action.level,
        retrasoMinutos: action.retrasoMinutos,
        actividadActualId: action.actividadActualId,
        dismissed: levelChanged ? false : state.dismissed,
        lastUpdated: Date.now(),
      }
    }
    case 'AI_LOADING':
      return { ...state, aiLoading: true, aiMessage: null }
    case 'AI_DONE':
      return { ...state, aiLoading: false, aiMessage: action.message }
    case 'DISMISS':
      return { ...state, dismissed: true }
    case 'RESET':
      return initial
    default:
      return state
  }
}

interface UseAlertEngineReturn {
  alertState: AlertState
  dismiss: () => void
}

export function useAlertEngine(
  dias: Day[],
  isCrucero: boolean
): UseAlertEngineReturn {
  const [alertState, dispatch] = useReducer(reducer, initial)

  const evaluate = useCallback(() => {
    const now = new Date()
    const allActivities: Activity[] = dias.flatMap((d) => d.actividades)
    const actividadActual = allActivities.find((a) => a.estado === 'en_curso')
    const proxima = allActivities.find((a) => a.estado === 'pendiente')
    const target = actividadActual ?? proxima

    if (!target?.horaInicio) {
      dispatch({
        type: 'UPDATE',
        level: 0,
        retrasoMinutos: 0,
        actividadActualId: null,
      })
      return
    }

    const retraso = calcularRetrasoMinutos(target.horaInicio, now)

    let minsEmbarque: number | undefined
    if (isCrucero) {
      const puerto = allActivities.find((a) => a.puertoCrucero === true)
      if (puerto?.horaInicio) {
        minsEmbarque = minutosParaEmbarque(puerto.horaInicio, now)
      }
    }

    const level = calculateAlertLevel(retraso, isCrucero, minsEmbarque)
    dispatch({
      type: 'UPDATE',
      level,
      retrasoMinutos: retraso,
      actividadActualId: target.id,
    })
  }, [dias, isCrucero])

  useEffect(() => {
    evaluate()
    const id = setInterval(evaluate, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [evaluate])

  useEffect(() => {
    if (alertState.level === 0 || alertState.dismissed) return

    void triggerAlertHaptic(alertState.level)

    if (alertState.level >= 4) {
      void Notifications.scheduleNotificationAsync({
        content: {
          title:
            alertState.level === 5
              ? '🚨 ALERTA CRÍTICA — Riesgo de perder el barco'
              : '⚠️ Retraso urgente en tu itinerario',
          body:
            alertState.level === 5
              ? 'Debes dirigirte al puerto AHORA.'
              : `Llevas ${alertState.retrasoMinutos} minutos de retraso.`,
          priority: 'max',
          sound: true,
        },
        trigger: null,
      })
    }
  }, [
    alertState.level,
    alertState.dismissed,
    alertState.lastUpdated,
    alertState.retrasoMinutos,
  ])

  useEffect(() => {
    if (alertState.level !== 3 || alertState.dismissed) return
    if (alertState.aiMessage || alertState.aiLoading) return

    const allActivities: Activity[] = dias.flatMap((d) => d.actividades)
    const actividadActual = allActivities.find(
      (a) => a.id === alertState.actividadActualId
    )
    if (!actividadActual) return

    const diaActual = actividadActual.diaIndex
    const restantes = allActivities.filter(
      (a) => a.diaIndex === diaActual && a.estado === 'pendiente'
    )

    dispatch({ type: 'AI_LOADING' })
    void generateAlertMessage(
      actividadActual,
      restantes,
      alertState.retrasoMinutos
    )
      .then((msg) => dispatch({ type: 'AI_DONE', message: msg }))
      .catch(() =>
        dispatch({
          type: 'AI_DONE',
          message: {
            mensajeAmigable: 'No se pudo obtener análisis. Revisa tu conexión.',
            actividadRecomendarQuitar: null,
            razonSimple: '',
            tiempoQueAhorra: 0,
            alternativa: null,
          },
        })
      )
  }, [
    alertState.level,
    alertState.dismissed,
    alertState.aiMessage,
    alertState.aiLoading,
    alertState.actividadActualId,
    alertState.retrasoMinutos,
    dias,
  ])

  const dismiss = useCallback(() => dispatch({ type: 'DISMISS' }), [])

  return { alertState, dismiss }
}
