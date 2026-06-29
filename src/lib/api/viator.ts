import type { SearchResponse, SearchResult } from './types'

const VIATOR_BASE_URL = 'https://api.viator.com/partner'

/**
 * Defensively normalize a Viator products response into SearchResult[]. The
 * exact shape is uncertain, so every field is optional-chained and we tolerate
 * a few plausible container keys. Unexpected shapes yield an empty list.
 */
function normalizeActivities(raw: unknown): SearchResult[] {
  const root = raw as Record<string, unknown> | null | undefined
  const candidate =
    (Array.isArray(raw) && raw) ||
    (Array.isArray(root?.['products']) && root?.['products']) ||
    (Array.isArray(root?.['data']) && root?.['data']) ||
    []

  const list = candidate as unknown[]
  const results: SearchResult[] = []
  for (let i = 0; i < list.length; i++) {
    const item = list[i] as Record<string, unknown> | null | undefined
    if (!item || typeof item !== 'object') {
      continue
    }

    const rawId = item['productCode'] ?? item['productId'] ?? item['id']
    const id =
      typeof rawId === 'string'
        ? rawId
        : typeof rawId === 'number'
          ? String(rawId)
          : `viator-${i}`

    const titleRaw = item['title'] ?? item['name']
    const title = typeof titleRaw === 'string' ? titleRaw : 'Activity'

    // Viator pricing may be nested, e.g. pricing.summary.fromPrice.
    const pricing = item['pricing'] as Record<string, unknown> | undefined
    const summary = pricing?.['summary'] as Record<string, unknown> | undefined
    const priceRaw =
      summary?.['fromPrice'] ??
      pricing?.['fromPrice'] ??
      item['fromPrice'] ??
      item['price']
    const price =
      typeof priceRaw === 'number'
        ? priceRaw
        : typeof priceRaw === 'string'
          ? Number(priceRaw)
          : undefined
    const currencyRaw = pricing?.['currency'] ?? item['currency']
    const currency = typeof currencyRaw === 'string' ? currencyRaw : undefined

    const urlRaw = item['productUrl'] ?? item['url'] ?? item['webURL']
    const url = typeof urlRaw === 'string' ? urlRaw : undefined

    const descRaw = item['shortDescription'] ?? item['description']
    const subtitle = typeof descRaw === 'string' ? descRaw : undefined

    results.push({
      id,
      title,
      provider: 'viator',
      ...(subtitle ? { subtitle } : {}),
      ...(price !== undefined && Number.isFinite(price) ? { price } : {}),
      ...(currency ? { currency } : {}),
      ...(url ? { url } : {}),
    })
  }
  return results
}

export async function searchActivities(
  destination: string,
  date: string
): Promise<SearchResponse> {
  const apiKey = process.env['VIATOR_API_KEY']

  if (!apiKey) {
    return { configured: false, results: [] }
  }

  try {
    const res = await fetch(
      `${VIATOR_BASE_URL}/search/products?destId=${encodeURIComponent(destination)}&startDate=${date}`,
      {
        headers: {
          'exp-api-key': apiKey,
          Accept: 'application/json;version=2.0',
        },
      }
    )

    if (!res.ok) {
      throw new Error(`Viator search failed: ${res.status}`)
    }

    const raw = await res.json()
    return { configured: true, results: normalizeActivities(raw) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { configured: true, results: [], error: message }
  }
}
