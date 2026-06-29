import type { Trip } from '@/types/trip'
import type { OfflineStorage, OfflineTripRecord } from './types'

/**
 * Web offline storage for itineraries.
 *
 * Mirrors the mobile key layout (`wayio:trip:<id>`, `wayio:activeTripId`) but
 * runs in the browser. We prefer IndexedDB (larger quota, structured values)
 * and transparently fall back to localStorage when IndexedDB is unavailable.
 *
 * Everything here is SSR-safe: every entry point guards `window`/`indexedDB`
 * access and degrades to a no-op (or `null`) on the server, so importing this
 * module from a Server Component never throws.
 */

const DB_NAME = 'wayio-offline'
const DB_VERSION = 1
const STORE = 'trips'
const ACTIVE_KEY = 'wayio:activeTripId'
const LS_TRIP_PREFIX = 'wayio:trip:'

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function hasIndexedDB(): boolean {
  return isBrowser() && typeof indexedDB !== 'undefined'
}

// ---------------------------------------------------------------------------
// IndexedDB implementation
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = run(transaction.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () =>
          reject(request.error ?? new Error('IndexedDB request failed'))
        transaction.oncomplete = () => db.close()
      })
  )
}

interface IdbRow extends OfflineTripRecord {
  id: string
}

const idbStorage: OfflineStorage = {
  async saveTrip(trip: Trip): Promise<void> {
    const row: IdbRow = { id: trip.id, trip, savedAt: new Date().toISOString() }
    await tx('readwrite', (store) => store.put(row))
  },
  async loadTrip(id: string): Promise<Trip | null> {
    const record = await idbStorage.getRecord(id)
    return record?.trip ?? null
  },
  async getRecord(id: string): Promise<OfflineTripRecord | null> {
    const row = await tx<IdbRow | undefined>('readonly', (store) =>
      store.get(id)
    )
    if (!row) return null
    return { trip: row.trip, savedAt: row.savedAt }
  },
  async removeTrip(id: string): Promise<void> {
    await tx('readwrite', (store) => store.delete(id))
  },
  async listTripIds(): Promise<string[]> {
    const keys = await tx<IDBValidKey[]>('readonly', (store) =>
      store.getAllKeys()
    )
    return keys.map((k) => String(k))
  },
  async saveActiveTripId(id: string): Promise<void> {
    writeLocal(ACTIVE_KEY, id)
  },
  async loadActiveTripId(): Promise<string | null> {
    return readLocal(ACTIVE_KEY)
  },
}

// ---------------------------------------------------------------------------
// localStorage fallback (and active-id store for the IndexedDB path)
// ---------------------------------------------------------------------------

function readLocal(key: string): string | null {
  if (!isBrowser()) return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* quota / private mode — best effort */
  }
}

function removeLocal(key: string): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* best effort */
  }
}

const localStorageBackend: OfflineStorage = {
  async saveTrip(trip: Trip): Promise<void> {
    const record: OfflineTripRecord = {
      trip,
      savedAt: new Date().toISOString(),
    }
    writeLocal(LS_TRIP_PREFIX + trip.id, JSON.stringify(record))
  },
  async loadTrip(id: string): Promise<Trip | null> {
    const record = await localStorageBackend.getRecord(id)
    return record?.trip ?? null
  },
  async getRecord(id: string): Promise<OfflineTripRecord | null> {
    const raw = readLocal(LS_TRIP_PREFIX + id)
    if (!raw) return null
    try {
      return JSON.parse(raw) as OfflineTripRecord
    } catch {
      return null
    }
  },
  async removeTrip(id: string): Promise<void> {
    removeLocal(LS_TRIP_PREFIX + id)
  },
  async listTripIds(): Promise<string[]> {
    if (!isBrowser()) return []
    const ids: string[] = []
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && key.startsWith(LS_TRIP_PREFIX)) {
          ids.push(key.slice(LS_TRIP_PREFIX.length))
        }
      }
    } catch {
      /* best effort */
    }
    return ids
  },
  async saveActiveTripId(id: string): Promise<void> {
    writeLocal(ACTIVE_KEY, id)
  },
  async loadActiveTripId(): Promise<string | null> {
    return readLocal(ACTIVE_KEY)
  },
}

/**
 * SSR-safe no-op backend used on the server. Reads resolve empty so callers can
 * run the same code path during render without branching.
 */
const noopBackend: OfflineStorage = {
  async saveTrip(): Promise<void> {},
  async loadTrip(): Promise<Trip | null> {
    return null
  },
  async getRecord(): Promise<OfflineTripRecord | null> {
    return null
  },
  async removeTrip(): Promise<void> {},
  async listTripIds(): Promise<string[]> {
    return []
  },
  async saveActiveTripId(): Promise<void> {},
  async loadActiveTripId(): Promise<string | null> {
    return null
  },
}

/** Picks the best available backend for the current runtime. */
export function getOfflineStorage(): OfflineStorage {
  if (!isBrowser()) return noopBackend
  if (hasIndexedDB()) return idbStorage
  return localStorageBackend
}

const storage = getOfflineStorage()

// Thin, mobile-parity function API on top of the selected backend.
export const saveTrip = (trip: Trip): Promise<void> => storage.saveTrip(trip)
export const loadTrip = (id: string): Promise<Trip | null> =>
  storage.loadTrip(id)
export const getTripRecord = (id: string): Promise<OfflineTripRecord | null> =>
  storage.getRecord(id)
export const removeTrip = (id: string): Promise<void> => storage.removeTrip(id)
export const listTripIds = (): Promise<string[]> => storage.listTripIds()
export const saveActiveTripId = (id: string): Promise<void> =>
  storage.saveActiveTripId(id)
export const loadActiveTripId = (): Promise<string | null> =>
  storage.loadActiveTripId()
