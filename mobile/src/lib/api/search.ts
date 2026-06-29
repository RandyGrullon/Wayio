/**
 * Real-time search client (hotels / activities / flights). These hit the same
 * Wayio web GET endpoints used by the website's `RealSearch`. They hold the
 * secret provider keys (Amadeus, Booking, Viator) and require NO auth, so the
 * mobile app can call them directly. When a provider key is missing the backend
 * answers `{ configured: false }` instead of failing — the UI handles that.
 */
import { config, assertBackendConfigured } from '../../config'

export type SearchProvider = 'amadeus' | 'booking' | 'viator'

export interface SearchResult {
  id: string
  title: string
  subtitle?: string
  price?: number
  currency?: string
  url?: string
  provider: SearchProvider
}

export interface SearchResponse {
  configured: boolean
  results: SearchResult[]
  error?: string
}

async function getJSON<T>(path: string): Promise<T> {
  assertBackendConfigured()
  const res = await fetch(`${config.apiUrl}${path}`)
  if (!res.ok) {
    throw new Error(`Backend ${path} respondió ${res.status}`)
  }
  return (await res.json()) as T
}

const enc = encodeURIComponent

/** Hotels for a destination/date range (provider: Booking). */
export function searchHotels(
  destination: string,
  checkIn: string,
  checkOut: string,
  guests: number
): Promise<SearchResponse> {
  return getJSON(
    `/api/hotels?destination=${enc(destination)}&checkIn=${enc(
      checkIn
    )}&checkOut=${enc(checkOut)}&guests=${enc(String(guests))}`
  )
}

/** Bookable activities for a destination/date (provider: Viator). */
export function searchActivities(
  destination: string,
  date: string
): Promise<SearchResponse> {
  return getJSON(
    `/api/activities?destination=${enc(destination)}&date=${enc(date)}`
  )
}

/** Flights between two IATA codes (provider: Amadeus). */
export function searchFlights(
  origin: string,
  destination: string,
  date: string,
  adults: number
): Promise<SearchResponse> {
  return getJSON(
    `/api/flights?origin=${enc(origin)}&destination=${enc(
      destination
    )}&date=${enc(date)}&adults=${enc(String(adults))}`
  )
}
