/**
 * Limpieza del modo en vivo al cerrar sesión: para el rastreo en segundo
 * plano y borra las copias locales del viaje, la cola de sincronización, los
 * recordatorios de avisos y la caché de rutas del mapa (memoria y disco). Así
 * la tarea no sigue con el viaje del usuario anterior y su cola no se sube con
 * la sesión del siguiente. No toca la preferencia de tema ('wayio-theme').
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { vaciarCacheRutas } from '../lib/mapa/rutas'
import { stopBackgroundTracking } from './backgroundLocation'

const CLAVES = new Set([
  'wayio:activeTripId',
  'wayio:pendingSync',
  'wayio:notificacionesEnviadas',
  'wayio:embarquesOcultos',
  'wayio:actividadesPendientes',
  'wayio:rutas:v2',
])
const PREFIJO_VIAJE = 'wayio:trip:'

/** Nunca lanza: cerrar sesión no puede fallar por esto. */
export async function limpiarModoEnVivo(): Promise<void> {
  await stopBackgroundTracking()
  // Antes que el borrado general: descarta también las respuestas en camino
  // y los guardados pendientes, que reescribirían el disco con la cuenta nueva.
  await vaciarCacheRutas().catch(() => undefined)
  try {
    const todas = await AsyncStorage.getAllKeys()
    const borrar = todas.filter(
      (k) => CLAVES.has(k) || k.startsWith(PREFIJO_VIAJE)
    )
    if (borrar.length > 0) await AsyncStorage.multiRemove(borrar)
  } catch {
    // Sin almacenamiento disponible: nada que borrar.
  }
}
