import { z } from 'zod'
import {
  autenticar,
  errorDb,
  errorJson,
  esUuid,
  leerJson,
  okJson,
} from '@/app/api/trips/_lib/http'
import { rateLimit, tooManyRequests } from '@/lib/security/rateLimit'

const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

/**
 * PUT /api/groups/[tripId]/location — comparte tu ubicación con el grupo.
 * Solo actualiza TU fila de miembro (RLS + privilegios por columna); solo la
 * ven los miembros del viaje. Body: { lat, lng }. Respuesta: { ok: true }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  if (!esUuid(id))
    return errorJson(404, 'No encontramos este grupo.', 'not_found')

  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const limite = await rateLimit({
    bucket: 'group-location',
    id: user.id,
    limit: 12,
    windowSec: 60,
  })
  if (!limite.ok) return tooManyRequests(limite)

  const leido = await leerJson(request, 1_000)
  if (!leido.ok) return leido.response
  const parsed = LocationSchema.safeParse(leido.body)
  if (!parsed.success) {
    return errorJson(400, 'La ubicación no es válida.', 'invalid_location')
  }

  const { data, error } = await supabase
    .from('trip_members')
    .update({
      lat_actual: parsed.data.lat,
      lng_actual: parsed.data.lng,
      ultima_ubicacion: new Date().toISOString(),
    })
    .eq('trip_id', id)
    .eq('user_id', user.id)
    .select('id')

  if (error) return errorDb(error, 'groups.location')
  if (!data || data.length === 0) {
    return errorJson(
      403,
      'No formas parte de este grupo, así que no podemos compartir tu ubicación.',
      'not_member'
    )
  }
  return okJson({ ok: true })
}
