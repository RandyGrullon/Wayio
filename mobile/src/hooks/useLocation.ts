import { useState, useEffect, useCallback } from 'react'
import * as Location from 'expo-location'
import type { UserLocation } from '../types/geofencing'

/**
 * Estado honesto de la ubicación en primer plano:
 * - 'inactiva': apagada por el viajero;
 * - 'activando': pidiendo permiso o esperando la PRIMERA posición;
 * - 'activa': ya llegó al menos una posición;
 * - 'denegada': sin permiso;
 * - 'apagada': la ubicación del teléfono está desactivada;
 * - 'error': no se pudo leer la posición.
 */
export type EstadoUbicacion =
  | 'inactiva'
  | 'activando'
  | 'activa'
  | 'denegada'
  | 'apagada'
  | 'error'

export interface UseLocationReturn {
  location: UserLocation | null
  estado: EstadoUbicacion
  /** Mensaje en español para mostrar, o null. */
  error: string | null
  /** true solo si ya se recibió una posición (compatibilidad). */
  isTracking: boolean
  /** false si el sistema ya no volverá a preguntar (hay que ir a Ajustes). */
  puedePedirPermiso: boolean
  requestPermissions: () => Promise<boolean>
  /** Vuelve a intentarlo tras un error o un permiso denegado. */
  reintentar: () => void
}

const MENSAJES = {
  denegada: 'Sin permiso de ubicación no podemos detectar tus llegadas.',
  apagada: 'La ubicación del teléfono está apagada.',
  error: 'No pudimos leer tu ubicación. Inténtalo de nuevo.',
} as const

/**
 * Sigue la posición mientras `activa` sea true y libera SIEMPRE el watcher
 * al apagarse o al salir de la pantalla (también si el permiso llega tarde).
 */
export function useLocation(activa = true): UseLocationReturn {
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [estadoInterno, setEstado] = useState<EstadoUbicacion>('activando')
  const [error, setError] = useState<string | null>(null)
  const [puedePedirPermiso, setPuedePedir] = useState(true)
  const [intento, setIntento] = useState(0)

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const actual = await Location.getForegroundPermissionsAsync()
      if (actual.granted) return true
      if (!actual.canAskAgain) {
        setPuedePedir(false)
        return false
      }
      const pedido = await Location.requestForegroundPermissionsAsync()
      setPuedePedir(pedido.canAskAgain)
      return pedido.granted
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    if (!activa) return undefined
    let cancelado = false
    let sub: Location.LocationSubscription | null = null

    const fallar = (estado: 'denegada' | 'apagada' | 'error'): void => {
      if (cancelado) return
      setEstado(estado)
      setError(MENSAJES[estado])
    }

    void (async () => {
      if (cancelado) return
      setEstado('activando')
      setError(null)
      try {
        const permitido = await requestPermissions()
        if (cancelado) return
        if (!permitido) {
          fallar('denegada')
          return
        }
        const servicios = await Location.hasServicesEnabledAsync()
        if (cancelado) return
        if (!servicios) {
          fallar('apagada')
          return
        }
        const nueva = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 5,
          },
          (loc) => {
            if (cancelado) return
            setLocation({
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              accuracy: loc.coords.accuracy ?? 0,
              timestamp: new Date(loc.timestamp),
            })
            setEstado('activa')
            setError(null)
          },
          () => fallar('error')
        )
        // La pantalla se cerró mientras se pedía el permiso: liberar ya.
        if (cancelado) {
          nueva.remove()
          return
        }
        sub = nueva
      } catch {
        fallar('error')
      }
    })()

    return () => {
      cancelado = true
      sub?.remove()
      sub = null
      // Al volver a activarla no se reutiliza la última posición ni se dice
      // «activa» antes de recibir una nueva (pill honesta, sin geocercas
      // evaluadas con una posición vieja).
      setLocation(null)
      setEstado('activando')
    }
  }, [activa, intento, requestPermissions])

  const reintentar = useCallback(() => setIntento((n) => n + 1), [])

  const estado: EstadoUbicacion = activa ? estadoInterno : 'inactiva'

  return {
    location: activa ? location : null,
    estado,
    error: activa ? error : null,
    isTracking: estado === 'activa',
    puedePedirPermiso,
    requestPermissions,
    reintentar,
  }
}
