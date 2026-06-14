/**
 * Geocodificación gratuita con OpenStreetMap Nominatim (sin API key).
 *
 * Se usa para anclar el itinerario en coordenadas reales: convertimos el
 * destino (y opcionalmente lugares concretos) en lat/lng verificados en lugar
 * de confiar 100% en lo que invente el modelo. Nominatim pide un User-Agent
 * identificable y limita a ~1 req/s, así que solo lo llamamos para el centro
 * del destino, no para cada actividad.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

export interface GeoPoint {
  lat: number
  lng: number
  displayName: string
}

export async function geocode(query: string): Promise<GeoPoint | null> {
  if (!query.trim()) return null
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    addressdetails: '0',
  })
  try {
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        'User-Agent': 'Wayio/1.0 (travel itinerary planner)',
        'Accept-Language': 'es',
      },
      // Cachear 1 semana: los destinos no se mueven.
      next: { revalidate: 60 * 60 * 24 * 7 },
    })
    if (!res.ok) return null
    const data = (await res.json()) as Array<{
      lat: string
      lon: string
      display_name: string
    }>
    const first = data[0]
    if (!first) return null
    return {
      lat: Number(first.lat),
      lng: Number(first.lon),
      displayName: first.display_name,
    }
  } catch {
    return null
  }
}
