import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Activity } from '../../types/activity'

/**
 * Copia local de «Para tu próxima visita» (actividades que no cupieron). La
 * fuente de verdad es trips.actividades_pendientes: el modo en vivo también
 * las guarda allí cuando el viajero es el dueño del viaje.
 */
const KEY = 'wayio:actividadesPendientes'

export async function cargarPendientes(): Promise<Activity[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    const lista: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(lista) ? (lista as Activity[]) : []
  } catch {
    return []
  }
}

export async function guardarEnPendientes(actividad: Activity): Promise<void> {
  const lista = await cargarPendientes()
  if (lista.some((a) => a.id === actividad.id)) return
  await AsyncStorage.setItem(KEY, JSON.stringify([...lista, actividad]))
}

export async function eliminarDePendientes(id: string): Promise<void> {
  const lista = await cargarPendientes()
  const filtrada = lista.filter((a) => a.id !== id)
  if (filtrada.length === lista.length) return
  await AsyncStorage.setItem(KEY, JSON.stringify(filtrada))
}
