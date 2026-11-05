import { z } from 'zod'
import { searchHotels } from '@/lib/api/booking'
import {
  liteapiConfigured,
  searchHotelRates,
  type MonedaHoteles,
} from '@/lib/api/liteapi'
import type { SearchResponse } from '@/lib/api/types'
import { clientIp, rateLimit } from '@/lib/security/rateLimit'
import { getRequestUser } from '@/lib/supabase/request'

/**
 * GET /api/hotels?destination=&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=[&currency=]
 *
 * - Sin LITEAPI_KEY: responde siempre { configured: false,
 *   reason: 'sin-proveedor', enlace } sin llamar a nada, con el enlace de
 *   afiliado de Booking.com ya preparado (web y app móvil). Límite por IP y
 *   caché pública.
 * - Con LITEAPI_KEY: hoteles con precio «desde» (total de la estancia) de
 *   LiteAPI (ver src/lib/api/liteapi.ts), en USD o EUR (`currency`;
 *   DOP → USD), con enlace de reserva a la marca blanca de LiteAPI o a
 *   Booking.com con el AID. Límite por usuario (si hay sesión) o IP y caché
 *   de 30 min por búsqueda en el servidor. Si el proveedor falla:
 *   configured=false con reason y el `enlace` de Booking.com.
 */

export const maxDuration = 20

const FECHA = /^\d{4}-\d{2}-\d{2}$/
/** Fecha de calendario real: Date.parse acepta '2026-02-31' (lo pasa a marzo). */
const fechaReal = (v: string): boolean => {
  const t = Date.parse(`${v}T00:00:00Z`)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v
}
const Fecha = z.string().regex(FECHA).refine(fechaReal)

// Un viaje de un solo día (salida = regreso) es válido en el formulario: en
// ese caso se busca una noche (lo resuelven searchHotels y searchHotelRates).
const QuerySchema = z
  .object({
    destination: z.string().trim().min(2).max(120),
    checkIn: Fecha,
    checkOut: Fecha,
    guests: z.coerce.number().int().min(1).max(20),
  })
  .refine((q) => q.checkOut >= q.checkIn, { path: ['checkOut'] })

/** Sin proveedor: el límite de siempre (por IP). */
const LIMITE = { limit: 60, windowSec: 10 * 60 }
/** Con proveedor: como /api/activities (por usuario o IP). */
const LIMITE_PROVEEDOR = { anonimo: 30, usuario: 60, windowSec: 10 * 60 }

function json(
  body: SearchResponse,
  status = 200,
  headers: Record<string, string> = {},
  conProveedor = false
): Response {
  // Con proveedor la ruta lee la sesión por cookies (Supabase puede renovarla
  // aquí con un Set-Cookie que un CDN nunca debe guardar): solo caché del
  // navegador y solo de respuestas buenas. La compartida la da unstable_cache.
  const cacheControl = conProveedor
    ? status === 200 && body.reason === undefined
      ? 'private, max-age=600'
      : 'no-store'
    : status === 200
      ? 'public, max-age=300, s-maxage=3600'
      : 'no-store'
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': cacheControl, ...headers },
  })
}

export async function GET(request: Request): Promise<Response> {
  const conProveedor = liteapiConfigured()

  let userId: string | null = null
  if (conProveedor) {
    try {
      userId = (await getRequestUser(request))?.id ?? null
    } catch {
      userId = null
    }
  }
  const limite = await rateLimit({
    bucket: 'search-hotels',
    id: userId ? `u:${userId}` : `ip:${clientIp(request)}`,
    ...(conProveedor
      ? {
          limit: userId ? LIMITE_PROVEEDOR.usuario : LIMITE_PROVEEDOR.anonimo,
          windowSec: LIMITE_PROVEEDOR.windowSec,
        }
      : LIMITE),
  })
  if (!limite.ok) {
    return json(
      {
        configured: conProveedor,
        results: [],
        reason: 'limite',
        mensaje:
          'Hiciste muchas búsquedas seguidas. Espera un momento y vuelve a intentarlo.',
      },
      429,
      { 'Retry-After': String(limite.retryAfter) },
      conProveedor
    )
  }

  const sp = new URL(request.url).searchParams
  const parsed = QuerySchema.safeParse({
    destination: sp.get('destination') ?? '',
    checkIn: sp.get('checkIn') ?? '',
    checkOut: sp.get('checkOut') ?? '',
    guests: sp.get('guests') ?? '1',
  })
  if (!parsed.success) {
    return json(
      {
        configured: conProveedor,
        results: [],
        reason: 'parametros-invalidos',
        mensaje:
          'Revisa el destino y las fechas: la salida no puede ser anterior a la llegada.',
      },
      400,
      {},
      conProveedor
    )
  }

  const q = parsed.data
  if (!conProveedor) {
    return json(
      searchHotels({
        destino: q.destination,
        checkIn: q.checkIn,
        checkOut: q.checkOut,
        huespedes: q.guests,
      })
    )
  }

  // `currency` es opcional y no se valida (un valor raro no da 400): EUR o USD.
  const moneda: MonedaHoteles =
    sp.get('currency')?.trim().toUpperCase() === 'EUR' ? 'EUR' : 'USD'
  const respuesta = await searchHotelRates({
    destino: q.destination,
    checkIn: q.checkIn,
    checkOut: q.checkOut,
    huespedes: q.guests,
    moneda,
  })
  return json(respuesta, 200, {}, true)
}
