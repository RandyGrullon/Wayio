'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Trip } from '@/types/trip'
import {
  getTripRecord,
  loadActiveTripId,
  loadTrip,
  saveActiveTripId,
  saveTrip,
} from '@/lib/offline'

export interface UseOfflineTripReturn {
  /** Live network status (mirrors `navigator.onLine`). */
  isOnline: boolean
  /** ISO timestamp of the last cached copy of the trip, if any. */
  savedAt: string | null
  /** Persist a trip for offline viewing and mark it active. */
  cacheTrip: (trip: Trip) => Promise<void>
  /** Read a cached trip (e.g. when a fetch fails because we're offline). */
  readCachedTrip: (id: string) => Promise<Trip | null>
  /** The id of the most recently viewed trip, if persisted. */
  getActiveTripId: () => Promise<string | null>
}

function getInitialOnline(): boolean {
  // SSR-safe: assume online during render; corrected in an effect on mount.
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

/**
 * Web counterpart to the mobile `useOfflineSync` hook. Lets any client screen
 * opt into persisting the currently-viewed itinerary so it stays viewable with
 * no connection, and exposes live online/offline status for UI.
 */
export function useOfflineTrip(tripId?: string): UseOfflineTripReturn {
  const [isOnline, setIsOnline] = useState<boolean>(getInitialOnline)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // Track network status. `online`/`offline` events only fire in the browser.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => setIsOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // Reflect whether the requested trip is already cached.
  useEffect(() => {
    let active = true
    const lookup = tripId ? getTripRecord(tripId) : Promise.resolve(null)
    void lookup.then((record) => {
      if (active) setSavedAt(record?.savedAt ?? null)
    })
    return () => {
      active = false
    }
  }, [tripId])

  const cacheTrip = useCallback(async (trip: Trip): Promise<void> => {
    await saveTrip(trip)
    await saveActiveTripId(trip.id)
    const record = await getTripRecord(trip.id)
    setSavedAt(record?.savedAt ?? null)
  }, [])

  const readCachedTrip = useCallback(
    (id: string): Promise<Trip | null> => loadTrip(id),
    []
  )

  const getActiveTripId = useCallback(
    (): Promise<string | null> => loadActiveTripId(),
    []
  )

  return { isOnline, savedAt, cacheTrip, readCachedTrip, getActiveTripId }
}
