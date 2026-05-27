import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Trip } from '../../types/trip'

const KEYS = {
  trip: (id: string) => `tripmind:trip:${id}`,
  activeTripId: 'tripmind:activeTripId',
  pendingSync: 'tripmind:pendingSync',
} as const

export async function saveTrip(trip: Trip): Promise<void> {
  await AsyncStorage.setItem(KEYS.trip(trip.id), JSON.stringify(trip))
}

export async function loadTrip(id: string): Promise<Trip | null> {
  const raw = await AsyncStorage.getItem(KEYS.trip(id))
  if (!raw) return null
  return JSON.parse(raw) as Trip
}

export async function saveActiveTripId(id: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.activeTripId, id)
}

export async function loadActiveTripId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.activeTripId)
}

export interface PendingSyncRecord {
  tripId: string
  activityId: string
  estado: string
  horaEntrada: string | undefined
  horaSalida: string | undefined
  updatedAt: string
}

export async function addPendingSync(record: PendingSyncRecord): Promise<void> {
  const raw = await AsyncStorage.getItem(KEYS.pendingSync)
  const existing: PendingSyncRecord[] = raw
    ? (JSON.parse(raw) as PendingSyncRecord[])
    : []
  existing.push(record)
  await AsyncStorage.setItem(KEYS.pendingSync, JSON.stringify(existing))
}

export async function loadPendingSync(): Promise<PendingSyncRecord[]> {
  const raw = await AsyncStorage.getItem(KEYS.pendingSync)
  if (!raw) return []
  return JSON.parse(raw) as PendingSyncRecord[]
}

export async function clearPendingSync(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.pendingSync)
}
