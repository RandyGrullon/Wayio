import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Linking, Platform } from 'react-native'
import * as Location from 'expo-location'

/**
 * Comparte la ubicación con el grupo mientras la sala está abierta y la app
 * en primer plano (docs/DISENO.md §6.8; mismo comportamiento que la web,
 * src/components/group/useCompartirUbicacion.ts). Solo arranca por una acción
 * del viajero (tras su consentimiento) y nunca se reactiva sola al volver a
 * entrar en la sala.
 *
 * Throttle (igual que la web): se envía la primera posición y después, como
 * mucho, una cada 30 s si te moviste al menos 25 m, o una cada 2 min con cada
 * lectura nueva del GPS.
 *
 * Solo primer plano: al pasar la app a segundo plano se suelta el GPS y al
 * volver se reanuda (si el viajero no lo había apagado). Nunca pide el
 * permiso «Siempre».
 *
 * Debe vivir en un componente que no se desmonte al cambiar de pestaña (la
 * Sala de GroupScreen): al desmontarse deja de compartir.
 */

const MIN_INTERVALO_MS = 30_000
const MAX_INTERVALO_MS = 120_000
const MIN_DISTANCIA_M = 25
/** Igual que el `timeout` de la web: sin lectura en 20 s se avisa. */
const TARDANZA_MS = 20_000
/** Si el GPS no arrancó, se vuelve a intentar sin apagar. */
const REINTENTO_MS = 20_000

const MENSAJES = {
  permiso:
    'No tenemos permiso para ver tu ubicación. Actívalo en los ajustes del teléfono para Wayio.',
  servicios:
    'La ubicación del teléfono está apagada. Actívala para compartirla con el grupo.',
  noDisponible: 'Este teléfono no puede compartir tu ubicación ahora.',
  tardando: 'Tu ubicación está tardando en llegar. Seguimos intentándolo.',
  sinLectura: 'No pudimos obtener tu ubicación ahora. Seguimos intentándolo.',
} as const

export type EstadoUbicacion = 'apagada' | 'activando' | 'activa' | 'denegada'

export interface SolucionUbicacion {
  label: string
  onPress: () => void
}

export interface CompartirUbicacion {
  estado: EstadoUbicacion
  error: string | null
  /** Acción para salir de un bloqueo (permiso o GPS apagado), o null. */
  solucion: SolucionUbicacion | null
  iniciar: () => void
  detener: () => void
}

type Bloqueo = 'permiso' | 'ajustes' | 'servicios'

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
  const [bloqueo, setBloqueo] = useState<Bloqueo | null>(null)

  const sub = useRef<Location.LocationSubscription | null>(null)
  /** Cada arranque/parada sube la sesión: lo que llegue de una vieja se ignora. */
  const sesion = useRef(0)
  /** El viajero lo encendió y no lo ha apagado (para reanudar al volver). */
  const deseada = useRef(false)
  /** Se soltó el GPS por pasar a segundo plano. */
  const pausada = useRef(false)
  const primerPlano = useRef(AppState.currentState !== 'background')
  const ultimo = useRef<Punto | null>(null)
  const enviando = useRef(false)
  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([])
  const enviarRef = useRef(enviar)
  const arrancarRef = useRef<() => Promise<void>>(async () => undefined)

  useEffect(() => {
    enviarRef.current = enviar
  }, [enviar])

  /** Suelta el GPS y cancela lo pendiente (no cambia el estado visible). */
  const soltar = useCallback(() => {
    sesion.current += 1
    sub.current?.remove()
    sub.current = null
    for (const t of temporizadores.current) clearTimeout(t)
    temporizadores.current = []
  }, [])

  const bloquear = useCallback(
    (motivo: Bloqueo | null, mensaje: string) => {
      soltar()
      deseada.current = false
      pausada.current = false
      ultimo.current = null
      setEstado('denegada')
      setBloqueo(motivo)
      setError(mensaje)
    },
    [soltar]
  )

  const recibir = useCallback((pos: Location.LocationObject) => {
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
  }, [])

  const arrancar = useCallback(async (): Promise<void> => {
    soltar()
    const mia = sesion.current
    const vigente = (): boolean => sesion.current === mia
    const programar = (fn: () => void, ms: number): void => {
      temporizadores.current.push(
        setTimeout(() => {
          if (vigente()) fn()
        }, ms)
      )
    }

    // 1. Permiso de primer plano (se pide solo si el sistema aún pregunta).
    try {
      let permiso = await Location.getForegroundPermissionsAsync()
      if (!permiso.granted && permiso.canAskAgain) {
        permiso = await Location.requestForegroundPermissionsAsync()
      }
      if (!vigente()) return
      if (!permiso.granted) {
        bloquear(permiso.canAskAgain ? 'permiso' : 'ajustes', MENSAJES.permiso)
        return
      }
      const servicios = await Location.hasServicesEnabledAsync()
      if (!vigente()) return
      if (!servicios) {
        bloquear('servicios', MENSAJES.servicios)
        return
      }
    } catch {
      if (vigente()) bloquear(null, MENSAJES.noDisponible)
      return
    }

    // Se fue a segundo plano mientras se pedía el permiso: reanudar al volver.
    if (!primerPlano.current) {
      pausada.current = deseada.current
      return
    }

    // 2. Seguir la posición (sin apagar si tarda o falla una lectura).
    programar(() => setError(MENSAJES.tardando), TARDANZA_MS)
    try {
      const nueva = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15_000,
          distanceInterval: 0,
        },
        (pos) => {
          if (vigente()) recibir(pos)
        },
        () => {
          if (vigente()) setError(MENSAJES.sinLectura)
        }
      )
      if (!vigente()) {
        nueva.remove()
        return
      }
      if (!primerPlano.current) {
        nueva.remove()
        soltar()
        pausada.current = deseada.current
        return
      }
      sub.current = nueva
    } catch {
      if (!vigente()) return
      setError(MENSAJES.sinLectura)
      programar(() => void arrancarRef.current(), REINTENTO_MS)
    }
  }, [soltar, bloquear, recibir])

  useEffect(() => {
    arrancarRef.current = arrancar
  }, [arrancar])

  // Solo en primer plano: suelta el GPS en segundo plano y lo reanuda al
  // volver. «inactive» (diálogos del sistema, centro de control) no cuenta.
  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (siguiente) => {
      if (siguiente === 'background') {
        primerPlano.current = false
        if (sub.current) {
          soltar()
          pausada.current = deseada.current
        }
        return
      }
      if (siguiente !== 'active') return
      primerPlano.current = true
      if (pausada.current && deseada.current) {
        pausada.current = false
        setEstado('activando')
        void arrancarRef.current()
      }
    })
    return () => suscripcion.remove()
  }, [soltar])

  // Al salir de la sala deja de compartir.
  useEffect(
    () => () => {
      deseada.current = false
      pausada.current = false
      soltar()
    },
    [soltar]
  )

  const iniciar = useCallback(() => {
    deseada.current = true
    pausada.current = false
    ultimo.current = null
    setError(null)
    setBloqueo(null)
    setEstado('activando')
    void arrancar()
  }, [arrancar])

  const detener = useCallback(() => {
    deseada.current = false
    pausada.current = false
    ultimo.current = null
    soltar()
    setEstado('apagada')
    setError(null)
    setBloqueo(null)
  }, [soltar])

  const solucion: SolucionUbicacion | null =
    estado !== 'denegada' || bloqueo === null
      ? null
      : bloqueo === 'permiso'
        ? { label: 'Volver a intentar', onPress: iniciar }
        : bloqueo === 'ajustes'
          ? {
              label: 'Abrir ajustes',
              onPress: () => void Linking.openSettings().catch(() => undefined),
            }
          : {
              label: 'Activar ubicación',
              onPress: () => {
                if (Platform.OS === 'android') {
                  Location.enableNetworkProviderAsync()
                    .then(iniciar)
                    .catch(() => Linking.openSettings().catch(() => undefined))
                } else {
                  void Linking.openSettings().catch(() => undefined)
                }
              },
            }

  return { estado, error, solucion, iniciar, detener }
}
