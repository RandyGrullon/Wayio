import { useState, useEffect, useCallback, useRef } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  SIN_ALERTA,
  claveEmbarque,
  evaluarAlertas,
  actividadesDeHoy,
  type Embarque,
  type EvaluacionAlerta,
} from '../lib/geofencing/alertEngine'
import { generateAlertMessage } from '../lib/ai/generateAlertMessage'
import { triggerAlertHaptic } from '../lib/haptics/patterns'
import { conTiempoLimite } from '../lib/scheduling/tiempoLimite'
import {
  CANAL_ALERTAS,
  CLAVE_EMBARQUES_OCULTOS,
  claveAvisoEmbarque,
  contenidoEmbarque,
  leerEmbarquesOcultos,
  notificar,
  notificarUnaVez,
} from '../tasks/notificaciones'
import type { Day } from '../types/trip'
import type { AlertState, AlertMessage } from '../types/alert'

/**
 * Motor de alertas en vivo.
 *
 * - Lee el MISMO estado de actividades que el geofencing (`dias` del viaje en
 *   vivo): al llegar a una actividad, deja de avisar de ella.
 * - Solo actividades de hoy, con fecha y hora completas (ver alertEngine).
 * - Háptico y notificación solo al SUBIR de nivel para cada actividad, con
 *   un mínimo de minutos entre notificaciones (salvo el embarque).
 * - Lo descartado no reaparece: ni el mismo nivel de la misma actividad, ni
 *   el embarque ocultado por hoy.
 */

const POLL_INTERVAL_MS = 30_000
/** La sugerencia de la IA no puede dejar la alerta «cargando» para siempre. */
const TIEMPO_IA_MS = 20_000
const ENTRE_NOTIFICACIONES_MS = 10 * 60_000

const MENSAJE_RESPALDO: AlertMessage = {
  mensajeAmigable:
    'Vas con retraso. Puedes seguir con tu plan o mover la próxima actividad a otro día.',
  actividadRecomendarQuitar: null,
  razonSimple: '',
  tiempoQueAhorra: 0,
  alternativa: null,
}

const claveDe = (ev: EvaluacionAlerta): string =>
  ev.embarque
    ? `embarque:${claveEmbarque(ev.embarque)}`
    : `${ev.actividadId}:${ev.level}`

const objetivoDe = (ev: EvaluacionAlerta): string =>
  ev.embarque
    ? `embarque:${claveEmbarque(ev.embarque)}`
    : (ev.actividadId ?? '')

interface Interno {
  ev: EvaluacionAlerta
  dismissed: boolean
  aiMessage: AlertMessage | null
  aiLoading: boolean
  /** Clave (actividad:nivel) a la que corresponde el mensaje de IA. */
  aiClave: string | null
  lastUpdated: number
}

const INICIAL: Interno = {
  ev: SIN_ALERTA,
  dismissed: false,
  aiMessage: null,
  aiLoading: false,
  aiClave: null,
  lastUpdated: 0,
}

export interface UseAlertEngineOptions {
  /**
   * true si hay posición (GPS real o simulada). Sin ella no se sabe si ya
   * llegaste, así que no se avisa de retrasos (sí del embarque).
   */
  conUbicacion?: boolean
}

export interface UseAlertEngineReturn {
  alertState: AlertState
  /** Datos de la vuelta al barco cuando level === 5. */
  embarque: Embarque | null
  /** Cierra la alerta actual (no vuelve para esa actividad y ese nivel). */
  dismiss: () => void
  /** «Continuar igual»: no volver a avisar de esa actividad hoy. */
  omitir: (actividadId: string) => void
  /** «Ocultar por hoy» la alerta de embarque. */
  ocultarEmbarqueHoy: () => void
}

export function useAlertEngine(
  dias: Day[],
  isCrucero: boolean,
  { conUbicacion = true }: UseAlertEngineOptions = {}
): UseAlertEngineReturn {
  const [interno, setInterno] = useState<Interno>(INICIAL)
  const descartadas = useRef(new Set<string>())
  const omitidas = useRef(new Set<string>())
  const embarquesOcultos = useRef(new Set<string>())
  const notificado = useRef(new Map<string, number>())
  const ultimaNotificacion = useRef(0)
  const diasRef = useRef(dias)

  useEffect(() => {
    diasRef.current = dias
  }, [dias])

  // Embarques ocultados hoy (sobreviven a cerrar la app).
  useEffect(() => {
    void leerEmbarquesOcultos().then((ocultos) => {
      for (const v of ocultos) embarquesOcultos.current.add(v)
    })
  }, [])

  const avisar = useCallback((ev: EvaluacionAlerta) => {
    const objetivo = objetivoDe(ev)
    const previo = notificado.current.get(objetivo) ?? 0
    if (ev.level <= previo) return
    notificado.current.set(objetivo, ev.level)
    void triggerAlertHaptic(ev.level)

    // Embarque: una sola notificación por día y puerto, compartida con la
    // tarea en segundo plano (misma clave), sin esperar al throttle.
    if (ev.embarque) {
      void notificarUnaVez(
        claveAvisoEmbarque(ev.embarque),
        contenidoEmbarque(ev.embarque),
        CANAL_ALERTAS
      )
      return
    }

    if (ev.level < 4) return
    const ahora = Date.now()
    if (ahora - ultimaNotificacion.current < ENTRE_NOTIFICACIONES_MS) return
    ultimaNotificacion.current = ahora
    const actividad = diasRef.current
      .flatMap((d) => d.actividades)
      .find((a) => a.id === ev.actividadId)
    void notificar(
      {
        title: 'Vas con retraso',
        body: actividad
          ? `Llevas ${ev.retrasoMinutos} min de retraso para ${actividad.nombre}. Abre Wayio para decidir qué hacer.`
          : `Llevas ${ev.retrasoMinutos} min de retraso. Abre Wayio para decidir qué hacer.`,
        ...(ev.actividadId ? { data: { actividadId: ev.actividadId } } : {}),
      },
      CANAL_ALERTAS
    )
  }, [])

  const evaluar = useCallback(() => {
    const ev = evaluarAlertas({
      dias: diasRef.current,
      ahora: new Date(),
      esCrucero: isCrucero,
      conUbicacion,
      omitidas: omitidas.current,
      embarquesOcultos: embarquesOcultos.current,
    })
    const clave = claveDe(ev)
    const dismissed = ev.level !== 0 && descartadas.current.has(clave)
    if (ev.level > 0 && !dismissed) avisar(ev)

    setInterno((prev) => {
      const mismo =
        prev.ev.level === ev.level &&
        prev.ev.actividadId === ev.actividadId &&
        prev.ev.retrasoMinutos === ev.retrasoMinutos &&
        prev.ev.embarque?.minutosRestantes === ev.embarque?.minutosRestantes &&
        prev.dismissed === dismissed
      if (mismo) return prev
      const cambioDeClave = claveDe(prev.ev) !== clave
      return {
        ...prev,
        ev,
        dismissed,
        lastUpdated: cambioDeClave ? Date.now() : prev.lastUpdated,
      }
    })
  }, [avisar, conUbicacion, isCrucero])

  // Sondeo cada 30 s, al cambiar el estado de las actividades y al volver
  // a la app.
  useEffect(() => {
    const id = setInterval(evaluar, POLL_INTERVAL_MS)
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') evaluar()
    })
    const primera = setTimeout(evaluar, 0)
    return () => {
      clearInterval(id)
      clearTimeout(primera)
      sub.remove()
    }
  }, [evaluar, dias])

  // Nivel 3: mensaje de la IA (una vez por actividad y nivel). La respuesta
  // se acepta solo si sigue siendo la misma alerta (aiClave); el retraso, que
  // cambia en cada sondeo, se lee de un ref para no relanzar la petición.
  const { ev, dismissed, aiClave } = interno
  const nivel = ev.level
  const actividadId = ev.actividadId
  const retrasoRef = useRef(0)
  useEffect(() => {
    retrasoRef.current = ev.retrasoMinutos
  }, [ev.retrasoMinutos])

  useEffect(() => {
    if (nivel !== 3 || dismissed || !actividadId) return
    const clave = `${actividadId}:3`
    if (aiClave === clave) return

    const hoy = actividadesDeHoy(diasRef.current, new Date())
    const actividad = hoy?.actividades.find((a) => a.id === actividadId)
    if (!hoy || !actividad) return
    const restantes = hoy.actividades.filter(
      (a) => a.estado === 'pendiente' && a.id !== actividad.id
    )

    setInterno((prev) => ({
      ...prev,
      aiClave: clave,
      aiLoading: true,
      aiMessage: null,
    }))
    conTiempoLimite(
      generateAlertMessage(actividad, restantes, retrasoRef.current, {
        nivel: 3,
        esCrucero: isCrucero,
      }),
      TIEMPO_IA_MS
    )
      .then((msg) => {
        const recomendada = msg.actividadRecomendarQuitar
        const valida =
          recomendada !== null &&
          restantes.some(
            (a) => a.id === recomendada || a.nombre === recomendada
          )
        setInterno((prev) =>
          prev.aiClave === clave
            ? {
                ...prev,
                aiLoading: false,
                aiMessage: {
                  mensajeAmigable: msg.mensajeAmigable,
                  actividadRecomendarQuitar: valida ? recomendada : null,
                  razonSimple: msg.razonSimple,
                  tiempoQueAhorra: msg.tiempoQueAhorra,
                  alternativa: msg.alternativa,
                },
              }
            : prev
        )
      })
      .catch(() => {
        setInterno((prev) =>
          prev.aiClave === clave
            ? { ...prev, aiLoading: false, aiMessage: MENSAJE_RESPALDO }
            : prev
        )
      })
  }, [nivel, actividadId, dismissed, aiClave, isCrucero])

  const dismiss = useCallback(() => {
    setInterno((prev) => {
      if (prev.ev.level === 0) return prev
      descartadas.current.add(claveDe(prev.ev))
      return { ...prev, dismissed: true }
    })
  }, [])

  const omitir = useCallback(
    (actividadId: string) => {
      omitidas.current.add(actividadId)
      evaluar()
    },
    [evaluar]
  )

  const ocultarEmbarqueHoy = useCallback(() => {
    setInterno((prev) => {
      if (!prev.ev.embarque) return prev
      const clave = claveEmbarque(prev.ev.embarque)
      embarquesOcultos.current.add(clave)
      descartadas.current.add(claveDe(prev.ev))
      void AsyncStorage.setItem(
        CLAVE_EMBARQUES_OCULTOS,
        JSON.stringify([...embarquesOcultos.current].slice(-30))
      ).catch(() => undefined)
      return { ...prev, dismissed: true }
    })
  }, [])

  const alertState: AlertState = {
    level: interno.ev.level,
    retrasoMinutos: interno.ev.retrasoMinutos,
    actividadActualId: interno.ev.actividadId,
    aiMessage:
      interno.aiClave === claveDe(interno.ev) ? interno.aiMessage : null,
    aiLoading: interno.aiClave === claveDe(interno.ev) && interno.aiLoading,
    dismissed: interno.dismissed,
    lastUpdated: interno.lastUpdated,
  }

  return {
    alertState,
    embarque: interno.ev.embarque,
    dismiss,
    omitir,
    ocultarEmbarqueHoy,
  }
}
