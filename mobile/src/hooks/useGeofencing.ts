import {
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AppState } from 'react-native'
import {
  addPendingSync,
  loadActiveTripId,
  loadTrip,
  saveActiveTripId,
  saveTrip,
} from '../lib/offline'
import {
  actividadesPlanas,
  buscarActividad,
  diaVigilado,
  evaluarPosicion,
  fusionarEstados,
  isoDe,
  marcarPerdida as marcarPerdidaEn,
  reagendar as reagendarEn,
  revivirFechas,
  type OpcionesReagendar,
} from '../lib/geofencing/liveTrip'
import type { Activity, ActivityEvaluation } from '../types/activity'
import type { Trip } from '../types/trip'
import type { UserLocation, GeofenceEvent } from '../types/geofencing'

/**
 * Estado del viaje en vivo: ÚNICA fuente de verdad de las actividades para el
 * geofencing, las alertas, la lista y el mapa. Se guarda en el teléfono en
 * cada cambio (la tarea en segundo plano lee y escribe la misma copia) y cada
 * cambio de estado se encola para sincronizar con activity_states.
 */

interface CambioPendiente {
  actividad: Activity
  momento: string
}

interface State {
  trip: Trip | null
  recentEvents: GeofenceEvent[]
  /** Cambios aún sin encolar para la sincronización. */
  pendientes: CambioPendiente[]
}

type Action =
  | { type: 'INIT'; trip: Trip }
  | { type: 'MERGE'; guardado: Trip }
  | {
      type: 'EVALUAR'
      lat: number
      lng: number
      ahora: Date
      diaForzado: number | null
    }
  | { type: 'PERDIDA'; id: string; ahora: Date }
  | {
      type: 'REAGENDAR'
      id: string
      dia: number
      opciones: OpcionesReagendar
      ahora: Date
    }
  | { type: 'ENCOLADOS'; cuantos: number }

const MAX_EVENTOS = 10

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INIT':
      return { trip: action.trip, recentEvents: [], pendientes: [] }

    case 'MERGE':
      if (!state.trip || state.trip.id !== action.guardado.id) return state
      return { ...state, trip: fusionarEstados(state.trip, action.guardado) }

    case 'EVALUAR': {
      if (!state.trip) return state
      const { trip, cambios } = evaluarPosicion(
        state.trip,
        action.lat,
        action.lng,
        diaVigilado(state.trip, action.ahora, action.diaForzado)
      )
      if (cambios.length === 0) return state
      const momento = action.ahora.toISOString()
      const eventos: GeofenceEvent[] = cambios.map((a) => ({
        activityId: a.id,
        activityNombre: a.nombre,
        type: a.estado === 'en_curso' ? 'enter' : 'exit',
        timestamp: action.ahora,
      }))
      return {
        trip,
        recentEvents: [...eventos, ...state.recentEvents].slice(0, MAX_EVENTOS),
        pendientes: [
          ...state.pendientes,
          ...cambios.map((actividad) => ({ actividad, momento })),
        ],
      }
    }

    case 'PERDIDA': {
      if (!state.trip) return state
      const trip = marcarPerdidaEn(state.trip, action.id)
      if (trip === state.trip) return state
      const actividad = actividadesPlanas(trip).find((a) => a.id === action.id)
      return {
        ...state,
        trip,
        pendientes: actividad
          ? [
              ...state.pendientes,
              { actividad, momento: action.ahora.toISOString() },
            ]
          : state.pendientes,
      }
    }

    case 'REAGENDAR': {
      if (!state.trip) return state
      const trip = reagendarEn(
        state.trip,
        action.id,
        action.dia,
        action.opciones
      )
      if (trip === state.trip) return state
      const actividad = actividadesPlanas(trip).find((a) => a.id === action.id)
      return {
        ...state,
        trip,
        pendientes: actividad
          ? [
              ...state.pendientes,
              { actividad, momento: action.ahora.toISOString() },
            ]
          : state.pendientes,
      }
    }

    case 'ENCOLADOS':
      return action.cuantos === 0
        ? state
        : { ...state, pendientes: state.pendientes.slice(action.cuantos) }

    default:
      return state
  }
}

export interface UseGeofencingOptions {
  /** Solo desarrollo: vigilar este día como si fuera hoy. */
  diaForzado?: number | null
}

export interface UseGeofencingReturn {
  /** Viaje con el estado vivo de cada actividad (null mientras carga). */
  trip: Trip | null
  /** Todas las actividades del viaje, en orden. */
  activities: ActivityEvaluation[]
  recentEvents: GeofenceEvent[]
  /** Última vez que se guardó la copia del viaje en el teléfono. */
  guardadoEn: Date | null
  /** «Me la perdí» / «Saltar actividad». */
  marcarPerdida: (id: string) => void
  /** Mueve la actividad a otro día (índice 0-based) y la deja pendiente. */
  reagendar: (id: string, dia: number, opciones?: OpcionesReagendar) => void
  /**
   * Quita la actividad que recomienda la IA (por id o, en respuestas
   * antiguas, por nombre). Devuelve la actividad quitada o null.
   */
  quitarRecomendada: (ref: string) => Activity | null
}

export function useGeofencing(
  location: UserLocation | null,
  tripInicial: Trip | null,
  opciones: UseGeofencingOptions = {}
): UseGeofencingReturn {
  const [state, dispatch] = useReducer(reducer, {
    trip: null,
    recentEvents: [],
    pendientes: [],
  })
  const [guardadoEn, setGuardadoEn] = useState<Date | null>(null)
  const tripRef = useRef<Trip | null>(null)
  const encolando = useRef(false)
  const diaForzado = opciones.diaForzado ?? null

  useEffect(() => {
    tripRef.current = state.trip
  }, [state.trip])

  // Carga: el viaje recibido + el avance guardado en el teléfono (sesiones
  // anteriores o la tarea en segundo plano). Sin viaje, el último activo.
  useEffect(() => {
    let cancelado = false
    void (async () => {
      try {
        if (tripInicial) {
          const guardado = await loadTrip(tripInicial.id)
          if (cancelado) return
          const trip = fusionarEstados(
            tripInicial,
            guardado ? revivirFechas(guardado) : null
          )
          dispatch({ type: 'INIT', trip })
          await saveActiveTripId(trip.id)
          return
        }
        const id = await loadActiveTripId()
        const guardado = id ? await loadTrip(id) : null
        if (!cancelado && guardado) {
          dispatch({ type: 'INIT', trip: revivirFechas(guardado) })
        }
      } catch {
        if (!cancelado && tripInicial) {
          dispatch({ type: 'INIT', trip: tripInicial })
        }
      }
    })()
    return () => {
      cancelado = true
    }
  }, [tripInicial])

  // Cada posición se evalúa contra el día vigilado (hoy).
  useEffect(() => {
    if (!location) return
    dispatch({
      type: 'EVALUAR',
      lat: location.lat,
      lng: location.lng,
      ahora: new Date(),
      diaForzado,
    })
  }, [location, diaForzado])

  // Una copia en el teléfono en cada cambio: la comparte la tarea en
  // segundo plano y sirve sin conexión.
  useEffect(() => {
    const trip = state.trip
    if (!trip) return
    let vigente = true
    void saveTrip(trip)
      .then(() => {
        if (vigente) setGuardadoEn(new Date())
      })
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [state.trip])

  // Cola de sincronización (activity_states), con el id del viaje en vivo.
  // Un lote a la vez: al terminar, ENCOLADOS dispara el siguiente.
  useEffect(() => {
    const tripId = state.trip?.id
    const lote = state.pendientes
    if (!tripId || lote.length === 0 || encolando.current) return
    encolando.current = true
    void (async () => {
      for (const { actividad, momento } of lote) {
        try {
          await addPendingSync({
            tripId,
            activityId: actividad.id,
            estado: actividad.estado,
            horaEntrada: isoDe(actividad.horaEntrada),
            horaSalida: isoDe(actividad.horaSalida),
            updatedAt: momento,
          })
        } catch {
          // Sin almacenamiento: el estado sigue guardado en el viaje.
        }
      }
      encolando.current = false
      dispatch({ type: 'ENCOLADOS', cuantos: lote.length })
    })()
  }, [state.pendientes, state.trip?.id])

  // Al volver a la app, trae lo que detectó la tarea en segundo plano.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      const id = tripRef.current?.id
      if (estado !== 'active' || !id) return
      void loadTrip(id)
        .then((guardado) => {
          if (guardado) {
            dispatch({ type: 'MERGE', guardado: revivirFechas(guardado) })
          }
        })
        .catch(() => undefined)
    })
    return () => sub.remove()
  }, [])

  const marcarPerdida = useCallback((id: string) => {
    dispatch({ type: 'PERDIDA', id, ahora: new Date() })
  }, [])

  const reagendar = useCallback(
    (id: string, dia: number, opcionesReagendar: OpcionesReagendar = {}) => {
      dispatch({
        type: 'REAGENDAR',
        id,
        dia,
        opciones: opcionesReagendar,
        ahora: new Date(),
      })
    },
    []
  )

  const quitarRecomendada = useCallback((ref: string): Activity | null => {
    const trip = tripRef.current
    if (!trip) return null
    const actividad = buscarActividad(trip, ref)
    if (!actividad) return null
    dispatch({ type: 'PERDIDA', id: actividad.id, ahora: new Date() })
    return actividad
  }, [])

  const activities = useMemo<ActivityEvaluation[]>(
    () =>
      state.trip
        ? actividadesPlanas(state.trip).map((a) => ({
            ...a,
            estadoCambiado: false,
          }))
        : [],
    [state.trip]
  )

  return {
    trip: state.trip,
    activities,
    recentEvents: state.recentEvents,
    guardadoEn,
    marcarPerdida,
    reagendar,
    quitarRecomendada,
  }
}
