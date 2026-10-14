/**
 * Notificaciones locales del modo en vivo: canales de Android, envío sin
 * errores y deduplicación persistente. El handler de presentación
 * (banner + lista) lo registra App.tsx.
 */
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import { palette } from '../theme'
import { formatHora12 } from '../lib/utils/formatters'
import { claveEmbarque, type Embarque } from '../lib/geofencing/alertEngine'

/** Rosa de Bayahíbe (DISENO §11: color de expo-notifications). */
export const COLOR_NOTIFICACION = palette.rosa[600]

export const CANAL_ALERTAS = 'wayio-alertas'
export const CANAL_LLEGADAS = 'wayio-llegadas'

let canales: Promise<void> | null = null

/** Crea (una vez) los canales de Android: alertas críticas y llegadas. */
export function prepararCanales(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve()
  canales ??= Promise.all([
    Notifications.setNotificationChannelAsync(CANAL_ALERTAS, {
      name: 'Alertas del viaje',
      description: 'Retrasos importantes y vuelta al barco.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: COLOR_NOTIFICACION,
    }),
    Notifications.setNotificationChannelAsync(CANAL_LLEGADAS, {
      name: 'Llegadas y salidas',
      description: 'Cuando llegas o terminas una actividad del día.',
      importance: Notifications.AndroidImportance.DEFAULT,
    }),
  ])
    .then(() => undefined)
    .catch(() => undefined)
  return canales
}

const CLAVE_ENVIADAS = 'wayio:notificacionesEnviadas'
const MAX_RECORDADAS = 300

async function leerEnviadas(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(CLAVE_ENVIADAS)
    const lista: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(lista)
      ? lista.filter((v): v is string => typeof v === 'string')
      : []
  } catch {
    return []
  }
}

export interface ContenidoNotificacion {
  title: string
  body: string
  data?: Record<string, unknown>
}

/** Lanza una notificación local ahora mismo. Nunca lanza errores. */
export async function notificar(
  contenido: ContenidoNotificacion,
  canal: typeof CANAL_ALERTAS | typeof CANAL_LLEGADAS
): Promise<void> {
  try {
    await prepararCanales()
    await Notifications.scheduleNotificationAsync({
      content: {
        ...contenido,
        sound: true,
        color: COLOR_NOTIFICACION,
        ...(canal === CANAL_ALERTAS
          ? {
              priority: Notifications.AndroidNotificationPriority.MAX,
              interruptionLevel: 'timeSensitive' as const,
            }
          : {}),
      },
      trigger: Platform.OS === 'android' ? { channelId: canal } : null,
    })
  } catch {
    // Sin permiso de notificaciones: el aviso se ve igualmente en la app.
  }
}

/**
 * Notifica una sola vez por `clave` (persistido en el teléfono), aunque la
 * tarea en segundo plano y la app evalúen la misma llegada.
 */
export async function notificarUnaVez(
  clave: string,
  contenido: ContenidoNotificacion,
  canal: typeof CANAL_ALERTAS | typeof CANAL_LLEGADAS
): Promise<boolean> {
  const enviadas = await leerEnviadas()
  if (enviadas.includes(clave)) return false
  try {
    await AsyncStorage.setItem(
      CLAVE_ENVIADAS,
      JSON.stringify([...enviadas, clave].slice(-MAX_RECORDADAS))
    )
  } catch {
    // Si no se puede recordar, se notifica igualmente.
  }
  await notificar(contenido, canal)
  return true
}

// ── Embarque (cruceros) ────────────────────────────────────────────────────
// La app abierta y la tarea en segundo plano usan la MISMA clave: la vuelta
// al barco se notifica una sola vez, la detecte quien la detecte.

/** Embarques ocultados con «Ocultar por hoy» (`fecha:actividadId`). */
export const CLAVE_EMBARQUES_OCULTOS = 'wayio:embarquesOcultos'

export async function leerEmbarquesOcultos(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(CLAVE_EMBARQUES_OCULTOS)
    const lista: unknown = raw ? JSON.parse(raw) : []
    return new Set(
      Array.isArray(lista)
        ? lista.filter((v): v is string => typeof v === 'string')
        : []
    )
  } catch {
    return new Set()
  }
}

export const claveAvisoEmbarque = (e: Embarque): string =>
  `embarque:${claveEmbarque(e)}`

/** Texto de la notificación de embarque (hora en 12 h es-DO). */
export function contenidoEmbarque(e: Embarque): ContenidoNotificacion {
  return {
    title: 'Hora de volver al barco',
    body: `Regresa a ${e.nombre} antes de las ${formatHora12(e.hora)} (en ${e.minutosRestantes} min).`,
    data: { actividadId: e.actividadId },
  }
}

/** Pide permiso de notificaciones sin lanzar (Expo Go o permiso denegado). */
export async function pedirPermisoNotificaciones(): Promise<boolean> {
  try {
    const actual = await Notifications.getPermissionsAsync()
    if (actual.granted) return true
    if (!actual.canAskAgain) return false
    const pedido = await Notifications.requestPermissionsAsync()
    return pedido.granted
  } catch {
    return false
  }
}
