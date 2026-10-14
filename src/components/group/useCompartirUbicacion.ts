'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Comparte la ubicación con el grupo mientras la página está abierta
 * (docs/DISENO.md §6.8). Solo arranca por una acción del usuario (tras su
 * consentimiento) y nunca se reactiva sola al recargar.
 *
 * Throttle: se envía la primera posición y después, como mucho, una cada
 * 30 s si te moviste al menos 25 m, o una cada 2 min con cada lectura nueva
 * del GPS (watchPosition solo avisa cuando el navegador tiene una lectura).
 *
 * Debe vivir en un componente que no se desmonte al cambiar de pestaña
 * (GroupRoom): al desmontarse deja de compartir.
 */

const MIN_INTERVALO_MS = 30_000
const MAX_INTERVALO_MS = 120_000
const MIN_DISTANCIA_M = 25

export type EstadoUbicacion = 'apagada' | 'activando' | 'activa' | 'denegada'

export interface CompartirUbicacion {
  estado: EstadoUbicacion
  error: string | null
  iniciar: () => void
  detener: () => void
}

interface Punto {
  lat: number
  lng: number
  t: number
}

/** Distancia aproximada en metros (haversine). */
function distancia(a: Punto, b: Punto): number {
  const R = 6_371_000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function useCompartirUbicacion(
  enviar: (lat: number, lng: number) => Promise<boolean>
): CompartirUbicacion {
  const [estado, setEstado] = useState<EstadoUbicacion>('apagada')
  const [error, setError] = useState<string | null>(null)
  const watchId = useRef<number | null>(null)
  const ultimo = useRef<Punto | null>(null)
  const enviando = useRef(false)
  const enviarRef = useRef(enviar)

  useEffect(() => {
    enviarRef.current = enviar
  }, [enviar])

  const limpiar = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== 'undefined') {
      navigator.geolocation?.clearWatch(watchId.current)
    }
    watchId.current = null
    ultimo.current = null
  }, [])

  // Al salir de la página deja de compartir.
  useEffect(() => limpiar, [limpiar])

  const detener = useCallback(() => {
    limpiar()
    setEstado('apagada')
  }, [limpiar])

  const iniciar = useCallback(() => {
    setError(null)
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setEstado('denegada')
      setError('Este navegador no puede compartir tu ubicación.')
      return
    }
    limpiar()
    setEstado('activando')
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const punto: Punto = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: Date.now(),
        }
        setEstado('activa')
        // Llegó una lectura: el aviso de «tardando» o «sin señal» ya no aplica.
        setError(null)
        const previo = ultimo.current
        const toca =
          !previo ||
          punto.t - previo.t >= MAX_INTERVALO_MS ||
          (punto.t - previo.t >= MIN_INTERVALO_MS &&
            distancia(previo, punto) >= MIN_DISTANCIA_M)
        if (!toca || enviando.current) return
        ultimo.current = punto
        enviando.current = true
        void enviarRef.current(punto.lat, punto.lng).finally(() => {
          enviando.current = false
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          limpiar()
          setEstado('denegada')
          setError(
            'No tenemos permiso para ver tu ubicación. Actívalo en los ajustes del navegador para este sitio.'
          )
          return
        }
        // Sin señal o tiempo agotado: se sigue intentando sin apagar.
        setError(
          err.code === err.TIMEOUT
            ? 'Tu ubicación está tardando en llegar. Seguimos intentándolo.'
            : 'No pudimos obtener tu ubicación ahora. Seguimos intentándolo.'
        )
      },
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 15_000 }
    )
  }, [limpiar])

  return { estado, error, iniciar, detener }
}
