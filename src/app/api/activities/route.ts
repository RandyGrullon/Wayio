import { z } from 'zod'
import {
  searchActivities,
  viatorConfigured,
  type MonedaViator,
} from '@/lib/api/viator'
import type { SearchResponse } from '@/lib/api/types'
import { clientIp, rateLimit } from '@/lib/security/rateLimit'
import { getRequestUser } from '@/lib/supabase/request'

/**
 * GET /api/activities?destination=&date=YYYY-MM-DD[&endDate=][&currency=]
 *
 * Actividades con precio de Viator (solo si VIATOR_API_KEY está configurada).
 * Límite por usuario (si hay sesión, por cookie o Bearer) o por IP, y caché de
 * 1 h por (destino, fechas, moneda) en el servidor.
 */

export const maxDuration = 15

const FECHA = /^\d{4}-\d{2}-\d{2}$/
/** Fecha de calendario real: Date.parse acepta '2026-02-31' (lo pasa a marzo). */
const fechaReal = (v: string): boolean => {
  const t = Date.parse(`${v}T00:00:00Z`)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v
}
const Fecha = z.string().regex(FECHA).refine(fechaReal)

const QuerySchema = z
  .object({
    destination: z.string().trim().min(2).max(120),
    date: Fecha,
    endDate: Fecha.optional(),
    currency: z.enum(['USD', 'EUR', 'DOP']).default('USD'),
  })
  .refine((q) => q.endDate === undefined || q.endDate >= q.date, {
    path: ['endDate'],
  })

const LIMITE = { anonimo: 30, usuario: 60, windowSec: 10 * 60 }

function json(
  body: SearchResponse,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  // Solo se cachea una respuesta buena del proveedor, y solo en el navegador
  // (private): esta ruta lee la sesión por cookies y Supabase puede renovarla
  // aquí con un Set-Cookie, que un CDN nunca debe guardar ni servir a otro
  // usuario. La caché compartida ya la da unstable_cache en el servidor.
  const cacheable = status === 200 && body.reason === undefined
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cacheable ? 'private, max-age=600' : 'no-store',
      ...headers,
    },
  })
}

export async function GET(request: Request): Promise<Response> {
  let userId: string | null = null
  try {
    userId = (await getRequestUser(request))?.id ?? null
  } catch {
    userId = null
  }
  const limite = await rateLimit({
    bucket: 'search-activities',
    id: userId ? `u:${userId}` : `ip:${clientIp(request)}`,
    limit: userId ? LIMITE.usuario : LIMITE.anonimo,
    windowSec: LIMITE.windowSec,
  })
  if (!limite.ok) {
    return json(
      {
        configured: viatorConfigured(),
        results: [],
        reason: 'limite',
        mensaje:
          'Hiciste muchas búsquedas seguidas. Espera un momento y vuelve a intentarlo.',
      },
      429,
      { 'Retry-After': String(limite.retryAfter) }
    )
  }

  const sp = new URL(request.url).searchParams
  const endDate = sp.get('endDate')
  const currency = sp.get('currency')
  const parsed = QuerySchema.safeParse({
    destination: sp.get('destination') ?? '',
    date: sp.get('date') ?? '',
    ...(endDate ? { endDate } : {}),
    ...(currency ? { currency: currency.toUpperCase() } : {}),
  })
  if (!parsed.success) {
    return json(
      {
        configured: viatorConfigured(),
        results: [],
        reason: 'parametros-invalidos',
        mensaje: 'Revisa el destino y las fechas de la búsqueda.',
      },
      400
    )
  }

  const q = parsed.data
  // Viator no cobra en pesos dominicanos: en ese caso pedimos USD.
  const moneda: MonedaViator = q.currency === 'EUR' ? 'EUR' : 'USD'
  const respuesta = await searchActivities({
    destino: q.destination,
    desde: q.date,
    hasta: q.endDate,
    moneda,
  })
  return json(respuesta)
}
