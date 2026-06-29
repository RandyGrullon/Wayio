import type { Trip } from '@/types/trip'

/**
 * An itinerary persisted for offline use, mirroring the mobile offline
 * storage shape (`wayio:trip:<id>` / `wayio:activeTripId`) while adding the
 * web-only metadata we need to expire/garbage-collect cached entries.
 */
export interface OfflineTripRecord {
  trip: Trip
  /** ISO timestamp of when this record was last written. */
  savedAt: string
}

export interface OfflineStorage {
  saveTrip(trip: Trip): Promise<void>
  loadTrip(id: string): Promise<Trip | null>
  getRecord(id: string): Promise<OfflineTripRecord | null>
  removeTrip(id: string): Promise<void>
  listTripIds(): Promise<string[]>
  saveActiveTripId(id: string): Promise<void>
  loadActiveTripId(): Promise<string | null>
}
