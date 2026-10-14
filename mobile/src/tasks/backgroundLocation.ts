/**
 * Geofencing con la app cerrada o en segundo plano.
 *
 * En cada posición: carga el viaje activo, evalúa SOLO las actividades de hoy,
 * GUARDA el nuevo estado (saveTrip) y notifica una única vez por actividad y
 * estado. Así la app, la tarea y la cola de sincronización comparten el mismo
 * estado y no hay notificaciones «Llegaste a…» en bucle.
 */
import * as TaskManager from 'expo-task-manager'
import * as Location from 'expo-location'
import {
  loadTrip,
  loadActiveTripId,
  saveTrip,
  addPendingSync,
} from '../lib/offline'
import { syncPendingChanges } from '../lib/offline/sync'
import {
  diaVigilado,
  evaluarPosicion,
  isoDe,
  revivirFechas,
} from '../lib/geofencing/liveTrip'
import { faseDelViaje } from '../lib/geofencing/fechas'
import { evaluarAlertas } from '../lib/geofencing/alertEngine'
import type { Trip } from '../types/trip'
import {
  CANAL_ALERTAS,
  CANAL_LLEGADAS,
  COLOR_NOTIFICACION,
  claveAvisoEmbarque,
  contenidoEmbarque,
  leerEmbarquesOcultos,
  notificarUnaVez,
  prepararCanales,
} from './notificaciones'

export const BACKGROUND_LOCATION_TASK = 'WAYIO_BACKGROUND_LOCATION'

interface LocationTaskData {
  locations: Location.LocationObject[]
}

void prepararCanales()

/**
 * Crucero con la app cerrada: avisa de la vuelta al barco una sola vez
 * (misma clave que la app abierta) y respeta «Ocultar por hoy».
 */
async function avisarEmbarque(trip: Trip, ahora: Date): Promise<void> {
  if (!trip.isCrucero) return
  const ev = evaluarAlertas({
    dias: trip.dias,
    ahora,
    esCrucero: true,
    conUbicacion: false,
    embarquesOcultos: await leerEmbarquesOcultos(),
  })
  if (ev.level !== 5 || !ev.embarque) return
  await notificarUnaVez(
    claveAvisoEmbarque(ev.embarque),
    contenidoEmbarque(ev.embarque),
    CANAL_ALERTAS
  )
}

TaskManager.defineTask(
  BACKGROUND_LOCATION_TASK,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<LocationTaskData>) => {
    if (error) return
    // La más reciente es la última del lote.
    const location = data?.locations?.at(-1)
    if (!location) return

    try {
      const tripId = await loadActiveTripId()
      if (!tripId) return
      const guardado = await loadTrip(tripId)
      if (!guardado) return
      const trip = revivirFechas(guardado)

      const ahora = new Date()
      // El viaje ya terminó: se deja de gastar batería.
      if (faseDelViaje(trip.dias, ahora).tipo === 'despues') {
        await stopBackgroundTracking()
        return
      }

      const { latitude, longitude } = location.coords
      const { trip: actualizado, cambios } = evaluarPosicion(
        trip,
        latitude,
        longitude,
        diaVigilado(trip, ahora)
      )
      if (cambios.length === 0) {
        await avisarEmbarque(trip, ahora)
        return
      }

      // Primero se guarda: la siguiente posición ya ve el nuevo estado.
      await saveTrip(actualizado)

      for (const actividad of cambios) {
        await addPendingSync({
          tripId,
          activityId: actividad.id,
          estado: actividad.estado,
          horaEntrada: isoDe(actividad.horaEntrada),
          horaSalida: isoDe(actividad.horaSalida),
          updatedAt: ahora.toISOString(),
        })
        const llega = actividad.estado === 'en_curso'
        await notificarUnaVez(
          `${tripId}:${actividad.id}:${actividad.estado}`,
          {
            title: llega
              ? `Llegaste a ${actividad.nombre}`
              : `Terminaste ${actividad.nombre}`,
            body: llega
              ? 'La marcamos como en curso en tu día.'
              : 'La marcamos como completada.',
            data: { activityId: actividad.id, tripId },
          },
          CANAL_LLEGADAS
        )
      }

      // Si ya llegaste al puerto (en curso), no hay aviso de embarque.
      await avisarEmbarque(actualizado, ahora)
      await syncPendingChanges()
    } catch {
      // Una posición fallida no debe tumbar la tarea: llegará otra.
    }
  }
)

export type ResultadoRastreo =
  /** Rastreo con la app cerrada activo. */
  | 'activo'
  /** Sin permiso «Permitir siempre»: solo funciona con la app abierta. */
  | 'solo_primer_plano'
  /** Sin permiso de ubicación. */
  | 'denegado'
  /** Esta versión de la app no permite el segundo plano (p. ej. Expo Go). */
  | 'no_disponible'

/**
 * Activa el rastreo en segundo plano. Nunca lanza: devuelve qué se consiguió
 * para que la pantalla lo cuente con honestidad.
 */
export async function startBackgroundTracking(): Promise<ResultadoRastreo> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync()
    if (fg.status !== 'granted') return 'denegado'

    const bg = await Location.requestBackgroundPermissionsAsync()
    if (bg.status !== 'granted') return 'solo_primer_plano'

    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK))
      return 'activo'

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 15_000,
      distanceInterval: 15,
      pausesUpdatesAutomatically: true,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Wayio sigue tu ruta',
        notificationBody: 'Detecta cuándo llegas a cada actividad de hoy.',
        notificationColor: COLOR_NOTIFICACION,
        killServiceOnDestroy: false,
      },
    })
    return 'activo'
  } catch {
    return 'no_disponible'
  }
}

/** Para el rastreo en segundo plano. Nunca lanza. */
export async function stopBackgroundTracking(): Promise<void> {
  try {
    const activo = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK
    )
    if (activo)
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)
  } catch {
    // Sin tarea registrada (Expo Go) o sin permisos: nada que parar.
  }
}

/** ¿Sigue activo el rastreo en segundo plano? (estado real, no supuesto). */
export async function isBackgroundTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK
    )
  } catch {
    return false
  }
}
