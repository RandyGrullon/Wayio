import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Activity } from '../../types/activity'

const KEY = 'tripmind:actividadesPendientes'

export async function guardarEnPendientes(actividad: Activity): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY)
  const lista: Activity[] = raw ? (JSON.parse(raw) as Activity[]) : []
  if (!lista.some((a) => a.id === actividad.id)) {
    lista.push(actividad)
    await AsyncStorage.setItem(KEY, JSON.stringify(lista))
  }
}

export async function cargarPendientes(): Promise<Activity[]> {
  const raw = await AsyncStorage.getItem(KEY)
  if (!raw) return []
  return JSON.parse(raw) as Activity[]
}

export async function eliminarDePendientes(id: string): Promise<void> {
  const lista = await cargarPendientes()
  const filtrada = lista.filter((a) => a.id !== id)
  await AsyncStorage.setItem(KEY, JSON.stringify(filtrada))
}
