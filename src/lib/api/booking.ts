import type { SearchResponse, SearchResult } from './types'

/**
 * Defensively normalize a Booking.com response into SearchResult[]. The exact
 * shape is uncertain, so every field is optional-chained and we tolerate a few
 * plausible container keys. Unexpected shapes yield an empty list, never a throw.
 */
function normalizeHotels(raw: unknown): SearchResult[] {
  const root = raw as Record<string, unknown> | null | undefined
  const candidate =
    (Array.isArray(raw) && raw) ||
    (Array.isArray(root?.['result']) && root?.['result']) ||
    (Array.isArray(root?.['hotels']) && root?.['hotels']) ||
    (Array.isArray(root?.['data']) && root?.['data']) ||
    []

  const list = candidate as unknown[]
  const results: SearchResult[] = []
  for (let i = 0; i < list.length; i++) {
    const item = list[i] as Record<string, unknown> | null | undefined
    if (!item || typeof item !== 'object') {
      continue
    }

    const rawId = item['hotel_id'] ?? item['id']
    const id =
      typeof rawId === 'string'
        ? rawId
        : typeof rawId === 'number'
          ? String(rawId)
          : `booking-${i}`

    const nameRaw = item['hotel_name'] ?? item['name'] ?? item['title']
    const title = typeof nameRaw === 'string' ? nameRaw : 'Hotel'

    const priceRaw =
      item['min_total_price'] ?? item['price'] ?? item['total_price']
    const price =
      typeof priceRaw === 'number'
        ? priceRaw
        : typeof priceRaw === 'string'
          ? Number(priceRaw)
          : undefined
    const currency =
      typeof item['currency'] === 'string'
        ? (item['currency'] as string)
        : typeof item['currencycode'] === 'string'
          ? (item['currencycode'] as string)
          : undefined
    const urlRaw = item['url'] ?? item['hotel_url']
    const url = typeof urlRaw === 'string' ? urlRaw : undefined
    const cityRaw = item['city'] ?? item['address']
    const subtitle = typeof cityRaw === 'string' ? cityRaw : undefined

    results.push({
      id,
      title,
      provider: 'booking',
      ...(subtitle ? { subtitle } : {}),
      ...(price !== undefined && Number.isFinite(price) ? { price } : {}),
      ...(currency ? { currency } : {}),
      ...(url ? { url } : {}),
    })
  }
  return results
}

export async function searchHotels(
  destination: string,
  checkIn: string,
  checkOut: string,
  guests: number
): Promise<SearchResponse> {
  const apiKey = process.env['BOOKING_API_KEY']

  if (!apiKey) {
    return { configured: false, results: [] }
  }

  try {
    const params = new URLSearchParams({
      destination,
      checkin_date: checkIn,
      checkout_date: checkOut,
      adults_number: String(guests),
    })

    const res = await fetch(
      `https://distribution-xml.booking.com/2.9/json/hotels?${params}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    )

    if (!res.ok) {
      throw new Error(`Booking.com search failed: ${res.status}`)
    }

    const raw = await res.json()
    return { configured: true, results: normalizeHotels(raw) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { configured: true, results: [], error: message }
  }
}
