import { z } from 'zod'
import { buildFlightsLink } from '@/constants/affiliateLinks'
import {
  searchFlights,
  travelpayoutsConfigured,
  type MonedaVuelos,
} from '@/lib/api/travelpayouts'
import type { SearchResponse } from '@/lib/api/types'
import { clientIp, rateLimit } from '@/lib/security/rateLimit'
import { getRequestUser } from '@/lib/supabase/request'

/**
 * GET /api/flights?origin=&destination=&date=YYYY-MM-DD[&returnDate=][&adults=][&currency=]
 *
 * `origin` y `destination` aceptan códigos IATA ('SDQ') o nombres de ciudad
 * ('Santo Domingo').
 *
 * - Sin TRAVELPAYOUTS_TOKEN (Amadeus Self-Service cerró en julio de 2026):
 *   responde siempre { configured: false, reason: 'sin-proveedor', enlace }
 *   sin llamar a nada; el enlace va a Skyscanner/Aviasales si se conocen los
 *   códigos y, si no, a Google Flights. Límite por IP y caché pública.
 * - Con TRAVELPAYOUTS_TOKEN: precios «desde» de la Aviasales Data API (ver
 *   src/lib/api/travelpayouts.ts), en USD o EUR (`currency`; DOP → USD), con
 *   el enlace de reserva en Aviasales con el marker de afiliado. Límite por
 *   usuario (si hay sesión) o IP y caché de 1 h por búsqueda en el servidor.
 *   Si el proveedor falla: configured=false con reason y `enlace`.
 */

export const maxDuration = 20

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
  const conProveedor = travelpayoutsConfigured()

  let userId: string | null = null
  if (conProveedor) {
    try {
      userId = (await getRequestUser(request))?.id ?? null
    } catch {
      userId = null
    }
  }
  const limite = await rateLimit({
    bucket: 'search-flights',
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
        configured: conProveedor,
        results: [],
        reason: 'parametros-invalidos',
        mensaje: 'Revisa el origen, el destino y las fechas del vuelo.',
      },
      400,
      {},
      conProveedor
    )
  }

  const q = parsed.data
  if (!conProveedor) {
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

  // `currency` es opcional y no se valida (un valor raro no da 400): EUR o USD.
  const moneda: MonedaVuelos =
    sp.get('currency')?.trim().toUpperCase() === 'EUR' ? 'EUR' : 'USD'
  const respuesta = await searchFlights({
    origen: q.origin,
    destino: q.destination,
    ida: q.date,
    vuelta: q.returnDate,
    adultos: q.adults,
    moneda,
  })
  const status = respuesta.reason === 'parametros-invalidos' ? 400 : 200
  return json(respuesta, status, {}, true)
}
