import { z } from 'zod'
import { buildFlightsLink } from '@/constants/affiliateLinks'
import type { SearchResponse } from '@/lib/api/types'
import { clientIp, rateLimit } from '@/lib/security/rateLimit'

/**
 * GET /api/flights?origin=&destination=&date=YYYY-MM-DD[&returnDate=][&adults=]
 *
 * Amadeus Self-Service cerró (julio de 2026) y no hay otro proveedor de
 * precios de vuelos: responde siempre { configured: false,
 * reason: 'sin-proveedor', enlace } sin llamar a nada. `origin` y
 * `destination` aceptan códigos IATA ('SDQ') o nombres de ciudad
 * ('Santo Domingo'); el enlace va a Skyscanner/Aviasales si se conocen los
 * códigos y, si no, a Google Flights.
 */

const FECHA = /^\d{4}-\d{2}-\d{2}$/
/** Fecha de calendario real: Date.parse acepta '2026-02-31' (lo pasa a marzo). */
const fechaReal = (v: string): boolean => {
  const t = Date.parse(`${v}T00:00:00Z`)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v
}
const Fecha = z.string().regex(FECHA).refine(fechaReal)

const QuerySchema = z
  .object({
    origin: z.string().trim().min(2).max(120),
    destination: z.string().trim().min(2).max(120),
    date: Fecha,
    returnDate: Fecha.optional(),
    adults: z.coerce.number().int().min(1).max(20),
  })
  .refine((q) => q.returnDate === undefined || q.returnDate >= q.date, {
    path: ['returnDate'],
  })

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
    bucket: 'search-flights',
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
  const returnDate = sp.get('returnDate')
  const parsed = QuerySchema.safeParse({
    origin: sp.get('origin') ?? '',
    destination: sp.get('destination') ?? '',
    date: sp.get('date') ?? '',
    ...(returnDate ? { returnDate } : {}),
    adults: sp.get('adults') ?? '1',
  })
  if (!parsed.success) {
    return json(
      {
        configured: false,
        results: [],
        reason: 'parametros-invalidos',
        mensaje: 'Revisa el origen, el destino y las fechas del vuelo.',
      },
      400
    )
  }

  const q = parsed.data
  return json({
    configured: false,
    results: [],
    reason: 'sin-proveedor',
    mensaje:
      'Compara precios de vuelos en el sitio de nuestro socio, con tus fechas ya puestas.',
    enlace: buildFlightsLink({
      origen: q.origin,
      destino: q.destination,
      ida: q.date,
      vuelta: q.returnDate,
      personas: q.adults,
    }),
  })
}
