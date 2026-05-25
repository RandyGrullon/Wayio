export interface PlaceDetails {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  rating?: number
  photos?: string[]
}

export async function searchPlace(query: string): Promise<PlaceDetails[]> {
  const apiKey = process.env['GOOGLE_MAPS_API_KEY']

  if (!apiKey) {
    throw new Error('Google Maps API key not configured')
  }

  const params = new URLSearchParams({ query, key: apiKey })
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`
  )

  if (!res.ok) {
    throw new Error(`Google Maps search failed: ${res.status}`)
  }

  const data = (await res.json()) as {
    results: Array<{
      place_id: string
      name: string
      formatted_address: string
      geometry: { location: { lat: number; lng: number } }
      rating?: number
    }>
  }

  return data.results.map((r) => {
    const place: PlaceDetails = {
      placeId: r.place_id,
      name: r.name,
      address: r.formatted_address,
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
    }
    if (r.rating !== undefined) place.rating = r.rating
    return place
  })
}

// Returns walking-time minutes for each consecutive activity pair.
// activities[i] → activities[i+1] maps to result[i].
// Falls back to 15 min per pair on API error or missing key.
export async function getTravelTimes(
  activities: Array<{ lat: number; lng: number }>
): Promise<number[]> {
  const apiKey = process.env['GOOGLE_MAPS_API_KEY']
  const pairCount = activities.length - 1
  const fallback = Array<number>(pairCount).fill(15)

  if (!apiKey || pairCount <= 0) return fallback

  const origins = activities
    .slice(0, -1)
    .map((a) => `${a.lat},${a.lng}`)
    .join('|')
  const destinations = activities
    .slice(1)
    .map((a) => `${a.lat},${a.lng}`)
    .join('|')

  const params = new URLSearchParams({
    origins,
    destinations,
    mode: 'walking',
    key: apiKey,
  })

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`
    )
    if (!res.ok) return fallback

    const data = (await res.json()) as {
      rows: Array<{
        elements: Array<{ status: string; duration: { value: number } }>
      }>
    }

    return Array.from({ length: pairCount }, (_, i) => {
      const el = data.rows[i]?.elements[i]
      return el?.status === 'OK' ? Math.round(el.duration.value / 60) : 15
    })
  } catch {
    return fallback
  }
}
