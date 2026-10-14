'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { UserLocation } from '@/types/geofencing'

/**
 * Ubicación en vivo, honesta (docs/DISENO.md §6.6):
 * - 'inactiva' → «Activar ubicación»
 * - 'activando' → «Activando…» (pedimos permiso o esperamos la primera fix)
 * - 'activa' → «Ubicación activa»: SOLO tras recibir la primera posición
 * - 'denegada' → «Permiso denegado · Cómo activarlo»
 * - 'no_disponible' → el navegador no ofrece geolocalización
 * - 'error' → no llega la posición (sin señal); se sigue intentando
 * Los mensajes de error van en español y aptos para mostrar.
 */
export type EstadoGPS =
  | 'inactiva'
  | 'activando'
  | 'activa'
  | 'denegada'
  | 'no_disponible'
  | 'error'

interface GPSState {
  location: UserLocation | null
  error: string | null
  estado: EstadoGPS
  /** Compatibilidad: true mientras se vigila la posición. */
  watching: boolean
}

export interface UseGPSReturn extends GPSState {
  startWatching: () => void
  stopWatching: () => void
}

const MENSAJE_DENEGADO =
  'No diste permiso para usar tu ubicación. Puedes activarlo en los ajustes del navegador.'
const MENSAJE_SIN_SENAL =
  'No pudimos obtener tu ubicación. Prueba en un lugar con mejor señal.'
const MENSAJE_LENTO =
  'Tu ubicación está tardando en llegar. Seguimos intentando.'
const MENSAJE_NO_SOPORTADO = 'Este navegador no permite usar la ubicación.'

const INICIAL: GPSState = {
  location: null,
  error: null,
  estado: 'inactiva',
  watching: false,
}

export function useGPS(): UseGPSReturn {
  const [state, setState] = useState<GPSState>(INICIAL)
  const watchIdRef = useRef<number | null>(null)

  // Si el permiso ya está denegado, lo mostramos antes de pedirlo.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions) return
    let activo = true
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((permiso) => {
        if (!activo) return
        if (permiso.state === 'denied') {
          setState((s) =>
            s.estado === 'inactiva' ? { ...s, estado: 'denegada' } : s
          )
        }
        permiso.onchange = () => {
          if (!activo) return
          if (permiso.state === 'denied') {
            setState((s) => ({
              ...s,
              estado: 'denegada',
              error: MENSAJE_DENEGADO,
              watching: false,
            }))
          } else {
            setState((s) =>
              s.estado === 'denegada'
                ? { ...s, estado: 'inactiva', error: null }
                : s
            )
          }
        }
      })
      .catch(() => {
        // Sin API de permisos: se sabrá al pedir la ubicación.
      })
    return () => {
      activo = false
    }
  }, [])

  const limpiarWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined') {
      navigator.geolocation?.clearWatch(watchIdRef.current)
    }
    watchIdRef.current = null
  }, [])

  const startWatching = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState((s) => ({
        ...s,
        estado: 'no_disponible',
        error: MENSAJE_NO_SOPORTADO,
        watching: false,
      }))
      return
    }
    limpiarWatch()
    setState((s) => ({
      ...s,
      estado: s.location ? 'activa' : 'activando',
      error: null,
      watching: true,
    }))
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          location: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          },
          error: null,
          estado: 'activa',
          watching: true,
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          limpiarWatch()
          setState((s) => ({
            ...s,
            estado: 'denegada',
            error: MENSAJE_DENEGADO,
            watching: false,
          }))
          return
        }
        // Sin señal o lento: watchPosition sigue intentándolo.
        setState((s) => ({
          ...s,
          estado: s.location ? 'activa' : 'error',
          error: err.code === err.TIMEOUT ? MENSAJE_LENTO : MENSAJE_SIN_SENAL,
        }))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    )
  }, [limpiarWatch])

  const stopWatching = useCallback(() => {
    limpiarWatch()
    setState((s) => ({
      ...s,
      estado: s.estado === 'denegada' ? 'denegada' : 'inactiva',
      watching: false,
      error: null,
    }))
  }, [limpiarWatch])

  useEffect(() => limpiarWatch, [limpiarWatch])

  return { ...state, startWatching, stopWatching }
}
