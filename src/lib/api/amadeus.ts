import type { SearchResponse, SearchResult } from './types'

const AMADEUS_BASE_URL = 'https://test.api.amadeus.com/v1'

interface AmadeusToken {
  access_token: string
  expires_in: number
}

async function getAccessToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const res = await fetch(`${AMADEUS_BASE_URL}/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    throw new Error(`Amadeus auth failed: ${res.status}`)
  }

  const data = (await res.json()) as AmadeusToken
  return data.access_token
}

/**
 * Defensively normalize an Amadeus flight-offers v2 response into SearchResult[].
 * Every field is optional-chained; unexpected shapes yield an empty list rather
 * than throwing. For v2 offers, price lives at `data[].price.total` / `.currency`.
 */
function normalizeFlights(raw: unknown): SearchResult[] {
  const data = (raw as { data?: unknown })?.data
  if (!Array.isArray(data)) {
    return []
  }

  const results: SearchResult[] = []
  for (let i = 0; i < data.length; i++) {
    const offer = data[i] as Record<string, unknown> | null | undefined
    if (!offer || typeof offer !== 'object') {
      continue
    }

    const id =
      typeof offer['id'] === 'string'
        ? offer['id']
        : typeof offer['id'] === 'number'
          ? String(offer['id'])
          : `amadeus-${i}`

    const price = offer['price'] as Record<string, unknown> | undefined
    const totalRaw = price?.['total']
    const total =
      typeof totalRaw === 'string'
        ? Number(totalRaw)
        : typeof totalRaw === 'number'
          ? totalRaw
          : undefined
    const currency =
      typeof price?.['currency'] === 'string'
        ? (price['currency'] as string)
        : undefined

    const itineraries = offer['itineraries']
    const firstItin = Array.isArray(itineraries) ? itineraries[0] : undefined
    const segments = (firstItin as { segments?: unknown })?.segments
    const firstSeg = Array.isArray(segments) ? segments[0] : undefined
    const lastSeg = Array.isArray(segments)
      ? segments[segments.length - 1]
      : undefined
    const from = (firstSeg as { departure?: { iataCode?: unknown } })?.departure
      ?.iataCode
    const to = (lastSeg as { arrival?: { iataCode?: unknown } })?.arrival
      ?.iataCode
    const subtitle =
      typeof from === 'string' && typeof to === 'string'
        ? `${from} → ${to}`
        : undefined

    results.push({
      id,
      title: 'Flight offer',
      provider: 'amadeus',
      ...(subtitle ? { subtitle } : {}),
      ...(total !== undefined && Number.isFinite(total)
        ? { price: total }
        : {}),
      ...(currency ? { currency } : {}),
    })
  }
  return results
}

export async function searchFlights(
  origin: string,
  destination: string,
  date: string,
  adults: number
): Promise<SearchResponse> {
  const clientId = process.env['AMADEUS_CLIENT_ID']
  const clientSecret = process.env['AMADEUS_CLIENT_SECRET']

  if (!clientId || !clientSecret) {
    return { configured: false, results: [] }
  }

  try {
    const token = await getAccessToken(clientId, clientSecret)
    const params = new URLSearchParams({
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate: date,
      adults: String(adults),
      max: '10',
    })

    const res = await fetch(
      `${AMADEUS_BASE_URL}/shopping/flight-offers?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    if (!res.ok) {
      throw new Error(`Amadeus flight search failed: ${res.status}`)
    }

    const raw = await res.json()
    return { configured: true, results: normalizeFlights(raw) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { configured: true, results: [], error: message }
  }
}
