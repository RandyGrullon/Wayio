import { useReducer, useEffect } from 'react'
import { geofenceDetector } from '../lib/geofencing/detector'
import { addPendingSync } from '../lib/offline'
import type { Activity, ActivityEvaluation } from '../types/activity'
import type { UserLocation, GeofenceEvent } from '../types/geofencing'

interface State {
  activities: ActivityEvaluation[]
  recentEvents: GeofenceEvent[]
  lastChanged: ActivityEvaluation[]
}

type Action =
  | { type: 'EVALUATE'; lat: number; lng: number }
  | { type: 'INIT'; activities: Activity[] }

function makeEvaluation(a: Activity): ActivityEvaluation {
  return { ...a, estadoCambiado: false }
}

function reducer(state: State, action: Action): State {
  if (action.type === 'INIT') {
    return {
      activities: action.activities.map(makeEvaluation),
      recentEvents: [],
      lastChanged: [],
    }
  }

  const evaluated = geofenceDetector.evaluateActivities(
    action.lat,
    action.lng,
    state.activities
  )
  const changed = evaluated.filter((a) => a.estadoCambiado)
  if (changed.length === 0) return { ...state, lastChanged: [] }

  const newEvents: GeofenceEvent[] = changed.map((activity) => ({
    activityId: activity.id,
    activityNombre: activity.nombre,
    type: activity.estado === 'en_curso' ? 'enter' : ('exit' as const),
    timestamp: new Date(),
  }))

  return {
    activities: evaluated,
    recentEvents: [...newEvents, ...state.recentEvents].slice(0, 10),
    lastChanged: changed,
  }
}

interface UseGeofencingReturn {
  activities: ActivityEvaluation[]
  recentEvents: GeofenceEvent[]
}

export function useGeofencing(
  location: UserLocation | null,
  tripId: string,
  initialActivities: Activity[]
): UseGeofencingReturn {
  const [state, dispatch] = useReducer(reducer, {
    activities: initialActivities.map(makeEvaluation),
    recentEvents: [],
    lastChanged: [],
  })

  useEffect(() => {
    dispatch({ type: 'INIT', activities: initialActivities })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialActivities.length])

  useEffect(() => {
    if (!location) return
    dispatch({ type: 'EVALUATE', lat: location.lat, lng: location.lng })
  }, [location])

  useEffect(() => {
    if (state.lastChanged.length === 0) return
    for (const activity of state.lastChanged) {
      void addPendingSync({
        tripId,
        activityId: activity.id,
        estado: activity.estado,
        horaEntrada: activity.horaEntrada?.toISOString(),
        horaSalida: activity.horaSalida?.toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
  }, [state.lastChanged, tripId])

  return { activities: state.activities, recentEvents: state.recentEvents }
}
