import { z } from 'zod'
import { searchHotels } from '@/lib/api/booking'
import type { SearchResponse } from '@/lib/api/types'
import { clientIp, rateLimit } from '@/lib/security/rateLimit'

/**
 * GET /api/hotels?destination=&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=
 *
 * Hoy no hay proveedor de precios de hoteles: responde siempre
 * { configured: false, reason: 'sin-proveedor', enlace } sin llamar a nada,
 * con el enlace de afiliado de Booking.com ya preparado (web y app móvil).
 */

const FECHA = /^\d{4}-\d{2}-\d{2}$/
/** Fecha de calendario real: Date.parse acepta '2026-02-31' (lo pasa a marzo). */
const fechaReal = (v: string): boolean => {
  const t = Date.parse(`${v}T00:00:00Z`)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v
}
const Fecha = z.string().regex(FECHA).refine(fechaReal)

// Un viaje de un solo día (salida = regreso) es válido en el formulario: en
// ese caso el enlace busca una noche (lo resuelve searchHotels).
const QuerySchema = z
  .object({
    destination: z.string().trim().min(2).max(120),
    checkIn: Fecha,
    checkOut: Fecha,
    guests: z.coerce.number().int().min(1).max(20),
  })
  .refine((q) => q.checkOut >= q.checkIn, { path: ['checkOut'] })

const LIMITE = { limit: 60, windowSec: 10 * 60 }

function json(
  body: SearchResponse,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control':
        status === 200 ? 'public, max-age=300, s-maxage=3600' : 'no-store',
      ...headers,
    },
  })
}

export async function GET(request: Request): Promise<Response> {
  const limite = await rateLimit({
    bucket: 'search-hotels',
    id: `ip:${clientIp(request)}`,
    ...LIMITE,
  })
  if (!limite.ok) {
    return json(
      {
        configured: false,
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
  const parsed = QuerySchema.safeParse({
    destination: sp.get('destination') ?? '',
    checkIn: sp.get('checkIn') ?? '',
    checkOut: sp.get('checkOut') ?? '',
    guests: sp.get('guests') ?? '1',
  })
  if (!parsed.success) {
    return json(
      {
        configured: false,
        results: [],
        reason: 'parametros-invalidos',
        mensaje:
          'Revisa el destino y las fechas: la salida no puede ser anterior a la llegada.',
      },
      400
    )
  }

  const q = parsed.data
  return json(
    searchHotels({
      destino: q.destination,
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      huespedes: q.guests,
    })
  )
}
