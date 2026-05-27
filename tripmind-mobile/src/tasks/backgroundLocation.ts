import * as TaskManager from 'expo-task-manager'
import * as Location from 'expo-location'
import * as Notifications from 'expo-notifications'
import { geofenceDetector } from '../lib/geofencing/detector'
import { loadTrip, loadActiveTripId, addPendingSync } from '../lib/offline'
import { syncPendingChanges } from '../lib/offline/sync'
import type { Activity } from '../types/activity'

export const BACKGROUND_LOCATION_TASK = 'TRIPMIND_BACKGROUND_LOCATION'

interface LocationTaskData {
  locations: Location.LocationObject[]
}

TaskManager.defineTask(
  BACKGROUND_LOCATION_TASK,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<LocationTaskData>) => {
    if (error) return

    const location = data.locations[0]
    if (!location) return

    const { latitude: userLat, longitude: userLng } = location.coords

    const tripId = await loadActiveTripId()
    if (!tripId) return

    const trip = await loadTrip(tripId)
    if (!trip) return

    const allActivities: Activity[] = trip.dias.flatMap((d) => d.actividades)
    const evaluated = geofenceDetector.evaluateActivities(
      userLat,
      userLng,
      allActivities
    )

    for (const activity of evaluated) {
      if (!activity.estadoCambiado) continue

      await addPendingSync({
        tripId,
        activityId: activity.id,
        estado: activity.estado,
        horaEntrada: activity.horaEntrada?.toISOString(),
        horaSalida: activity.horaSalida?.toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const isEnter = activity.estado === 'en_curso'
      await Notifications.scheduleNotificationAsync({
        content: {
          title: isEnter
            ? `📍 Llegaste a ${activity.nombre}`
            : `✅ Saliste de ${activity.nombre}`,
          body: isEnter
            ? 'La actividad ha comenzado automáticamente.'
            : 'Actividad marcada como completada.',
          data: { activityId: activity.id, tripId },
        },
        trigger: null,
      })
    }

    await syncPendingChanges()
  }
)

export async function startBackgroundTracking(): Promise<void> {
  const { status } = await Location.requestBackgroundPermissionsAsync()
  if (status !== 'granted') return

  const isRunning = await Location.hasStartedLocationUpdatesAsync(
    BACKGROUND_LOCATION_TASK
  )
  if (isRunning) return

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 10000,
    distanceInterval: 0,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'TripMind GPS activo',
      notificationBody: 'Detectando actividades cercanas...',
      notificationColor: '#2563EB',
    },
  })
}

export async function stopBackgroundTracking(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(
    BACKGROUND_LOCATION_TASK
  )
  if (!isRunning) return
  await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)
}
