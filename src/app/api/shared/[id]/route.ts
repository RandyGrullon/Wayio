import { leerViajeCompartido } from '../_lib/compartido'
import { esUuid } from '@/app/api/trips/_lib/http'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/security/rateLimit'

/**
 * GET /api/shared/[id] — vista PÚBLICA de un viaje (sin sesión).
 *
 * Solo responde si el dueño marcó el viaje como público (PATCH
 * /api/trips/[id] { is_public: true }). Devuelve el itinerario, el destino y
 * las fechas; nunca grupo_link ni user_id. Caché corta en CDN y noindex para
 * que los viajes de los usuarios no acaben en buscadores.
 *
 * Respuesta 200: { trip: { id, data: Trip, destino, fechaInicio, fechaFin } }
 */

const NO_INDEX = 'noindex, nofollow, noarchive'

function error(status: number, mensaje: string, code: string): Response {
  return Response.json(
    { error: mensaje, code },
    {
      status,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': NO_INDEX },
    }
  )
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  if (!esUuid(id)) {
    return error(
      404,
      'Este viaje no existe o ya no está compartido.',
      'not_found'
    )
  }

  const limite = await rateLimit({
    bucket: 'shared-trip',
    id: clientIp(request),
    limit: 120,
    windowSec: 60,
  })
  if (!limite.ok) return tooManyRequests(limite)

  const compartido = await leerViajeCompartido(id)
  if (compartido === 'no_disponible') {
    return error(
      503,
      'La vista compartida no está disponible en este momento. Inténtalo más tarde.',
      'shared_unavailable'
    )
  }
  if (!compartido) {
    return error(
      404,
      'Este viaje no existe o ya no está compartido.',
      'not_found'
    )
  }

  return Response.json(
    {
      trip: {
        id,
        data: compartido.data,
        destino: compartido.destino,
        fechaInicio: compartido.fecha_inicio,
        fechaFin: compartido.fecha_fin,
      },
    },
    {
      headers: {
        'Cache-Control':
          'public, max-age=60, s-maxage=60, stale-while-revalidate=120',
        'X-Robots-Tag': NO_INDEX,
      },
    }
  )
}
