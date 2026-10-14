import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { unstable_cache } from 'next/cache'
import { buildActivityLink } from '@/constants/affiliateLinks'
import type { SearchResponse, SearchResult } from './types'

/**
 * Actividades reservables con la Viator Partner API v2 (afiliado, "Basic
 * Access"): POST /partner/search/freetext con searchTypes PRODUCTS.
 *
 * Solo se llama si existe VIATOR_API_KEY. Los resultados se cachean 1 h por
 * (destino, fechas, moneda) y el mapeo es defensivo: un cambio de forma en la
 * respuesta da una lista vacía, nunca una excepción.
 *
 * Documentación: https://docs.viator.com/partner-api/technical/
 */

const DEFAULT_BASE_URL = 'https://api.viator.com/partner'
const TIMEOUT_MS = 8000
const CACHE_SEGUNDOS = 60 * 60
const MAX_RESULTADOS = 12

/** Monedas que pedimos a Viator (DOP no está soportada: se usa USD). */
export const MONEDAS_VIATOR = ['USD', 'EUR'] as const
export type MonedaViator = (typeof MONEDAS_VIATOR)[number]

export interface ActivitySearchParams {
  destino: string
  /** Primer día 'YYYY-MM-DD'. */
  desde: string
  /** Último día 'YYYY-MM-DD' (por defecto, el mismo que `desde`). */
  hasta?: string | undefined
  moneda: MonedaViator
}

export function viatorConfigured(): boolean {
  return Boolean(process.env['VIATOR_API_KEY']?.trim())
}

function baseUrl(): string {
  const custom = process.env['VIATOR_API_URL']?.trim()
  return (custom || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

// ---------------------------------------------------------------------------
// Mapeo defensivo
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>

const esObj = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const texto = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined

const numero = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

/** Solo enlaces https de Viator (nada de javascript: ni dominios ajenos). */
function urlSegura(v: unknown, dominios: RegExp): string | undefined {
  const s = texto(v)
  if (!s) return undefined
  try {
    const u = new URL(s)
    return u.protocol === 'https:' && dominios.test(u.hostname)
      ? u.toString()
      : undefined
  } catch {
    return undefined
  }
}

const DOMINIO_VIATOR = /(?:^|\.)viator\.com$/i
const DOMINIO_IMAGENES = /(?:^|\.)(?:viator\.com|tacdn\.com|tripadvisor\.com)$/i

function recortar(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}

function imagen(item: Obj): string | undefined {
  const imagenes = Array.isArray(item['images']) ? item['images'] : []
  const portada =
    imagenes.find((i) => esObj(i) && i['isCover'] === true) ?? imagenes[0]
  if (!esObj(portada) || !Array.isArray(portada['variants'])) return undefined
  // La variante más cercana a 480 px de ancho.
  let mejor: { url: string; d: number } | null = null
  for (const v of portada['variants']) {
    if (!esObj(v)) continue
    const url = urlSegura(v['url'], DOMINIO_IMAGENES)
    const ancho = numero(v['width'])
    if (!url || ancho === undefined) continue
    const d = Math.abs(ancho - 480)
    if (!mejor || d < mejor.d) mejor = { url, d }
  }
  return mejor?.url
}

function lista(raw: unknown): unknown[] {
  if (!esObj(raw)) return []
  const products = raw['products']
  if (esObj(products) && Array.isArray(products['results'])) {
    return products['results']
  }
  if (Array.isArray(products)) return products
  if (Array.isArray(raw['data'])) return raw['data']
  return []
}

export function normalizeViatorProducts(raw: unknown): SearchResult[] {
  const resultados: SearchResult[] = []
  for (const item of lista(raw)) {
    if (!esObj(item)) continue
    const id = texto(item['productCode']) ?? texto(item['productId'])
    const title = texto(item['title'])
    if (!id || !title) continue

    const pricing = esObj(item['pricing']) ? item['pricing'] : undefined
    const summary =
      pricing && esObj(pricing['summary']) ? pricing['summary'] : undefined
    const price = numero(summary?.['fromPrice'])
    const currency = texto(pricing?.['currency'])

    const reviews = esObj(item['reviews']) ? item['reviews'] : undefined
    const rating = numero(reviews?.['combinedAverageRating'])
    const totalReviews = numero(reviews?.['totalReviews'])

    const duration = esObj(item['duration']) ? item['duration'] : undefined
    const minutos =
      numero(duration?.['fixedDurationInMinutes']) ??
      numero(duration?.['variableDurationFromMinutes'])

    const descripcion = texto(item['description'])
    const url = urlSegura(item['productUrl'], DOMINIO_VIATOR)
    const imageUrl = imagen(item)

    resultados.push({
      id,
      title,
      provider: 'viator',
      ...(descripcion ? { subtitle: recortar(descripcion, 140) } : {}),
      ...(price !== undefined && price >= 0 ? { price } : {}),
      ...(currency ? { currency } : {}),
      ...(url ? { url } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(rating !== undefined && rating >= 0 && rating <= 5 ? { rating } : {}),
      ...(totalReviews !== undefined && totalReviews >= 0
        ? { reviews: Math.round(totalReviews) }
        : {}),
      ...(minutos !== undefined && minutos > 0
        ? { durationMinutes: Math.round(minutos) }
        : {}),
    })
    if (resultados.length >= MAX_RESULTADOS) break
  }
  return resultados
}

// ---------------------------------------------------------------------------
// Llamada (cacheada)
// ---------------------------------------------------------------------------

class ViatorError extends Error {
  constructor(
    message: string,
    readonly status: number | null
  ) {
    super(message)
    this.name = 'ViatorError'
  }
}

async function buscarEnViator(
  destino: string,
  desde: string,
  hasta: string,
  moneda: MonedaViator
): Promise<SearchResult[]> {
  const apiKey = process.env['VIATOR_API_KEY']?.trim()
  if (!apiKey) throw new ViatorError('sin clave', null)

  const res = await fetch(`${baseUrl()}/search/freetext`, {
    method: 'POST',
    headers: {
      'exp-api-key': apiKey,
      Accept: 'application/json;version=2.0',
      'Accept-Language': 'es-ES',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      searchTerm: destino,
      productFiltering: { dateRange: { from: desde, to: hasta } },
      searchTypes: [
        {
          searchType: 'PRODUCTS',
          pagination: { start: 1, count: MAX_RESULTADOS },
        },
      ],
      currency: moneda,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new ViatorError(`Viator respondió ${res.status}`, res.status)
  }
  return normalizeViatorProducts(await res.json())
}

// La caché solo guarda respuestas buenas: si la llamada lanza, no se cachea.
const buscarCacheado = unstable_cache(buscarEnViator, ['viator-freetext-v2'], {
  revalidate: CACHE_SEGUNDOS,
  tags: ['viator'],
})

function esTimeout(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'TimeoutError' || err.name === 'AbortError')
  )
}

export async function searchActivities(
  p: ActivitySearchParams
): Promise<SearchResponse> {
  const enlace = buildActivityLink('', p.destino)
  if (!viatorConfigured()) {
    return {
      configured: false,
      results: [],
      reason: 'no-configurado',
      mensaje:
        'Pronto verás aquí actividades con precio. Mientras, puedes explorarlas en Viator.',
      enlace,
    }
  }

  const destino = p.destino.trim().replace(/\s+/g, ' ')
  const hasta = p.hasta && p.hasta >= p.desde ? p.hasta : p.desde
  try {
    const results = await buscarCacheado(destino, p.desde, hasta, p.moneda)
    return {
      configured: true,
      results,
      ...(results.length === 0
        ? {
            mensaje:
              'No encontramos actividades para esas fechas. Prueba en Viator con otras fechas.',
            enlace,
          }
        : {}),
    }
  } catch (err) {
    const timeout = esTimeout(err)
    if (!timeout) {
      try {
        Sentry.captureException(err, { tags: { proveedor: 'viator' } })
      } catch {
        /* sin monitorización */
      }
    }
    return {
      configured: true,
      results: [],
      reason: timeout ? 'tiempo-agotado' : 'error-proveedor',
      mensaje:
        'No pudimos cargar las actividades ahora mismo. Inténtalo de nuevo en un rato.',
      enlace,
    }
  }
}
