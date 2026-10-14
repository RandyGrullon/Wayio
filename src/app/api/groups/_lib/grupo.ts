import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  errorDb,
  errorJson,
  esFaltaDeEsquema,
  esUuid,
  okJson,
} from '@/app/api/trips/_lib/http'
import type { TripMemberRow } from '@/types/database'

/**
 * Lógica común de las rutas de grupo. La seguridad real la ponen las RLS por
 * membresía (supabase/schema.sql): estas comprobaciones solo sirven para
 * responder 403/404 claros en vez de listas vacías.
 */

const NO_MIEMBRO =
  'No formas parte de este grupo. Pide a quien organiza el viaje su enlace de invitación.'

/**
 * Devuelve una respuesta de error si el usuario no es dueño ni miembro del
 * viaje, o null si puede continuar.
 */
export async function exigirMiembro(
  supabase: SupabaseClient,
  tripId: string
): Promise<Response | null> {
  if (!esUuid(tripId)) {
    return errorJson(404, 'No encontramos este grupo.', 'not_found')
  }

  const { data, error } = await supabase.rpc('is_trip_member', {
    p_trip: tripId,
  })
  if (!error) {
    return data === true ? null : errorJson(403, NO_MIEMBRO, 'not_member')
  }

  // Sin la migración (no existe la función): RLS decide si veo el viaje.
  if (esFaltaDeEsquema(error)) {
    const { data: trip } = await supabase
      .from('trips')
      .select('id')
      .eq('id', tripId)
      .maybeSingle()
    return trip ? null : errorJson(403, NO_MIEMBRO, 'not_member')
  }
  return errorDb(error, 'groups.is_trip_member')
}

/**
 * Une al usuario al viaje cuyo grupo_link es `link` (RPC join_trip).
 * Respuesta 200: { tripId: string, member: TripMemberRow | null }
 */
export async function unirsePorLink(
  supabase: SupabaseClient,
  user: User,
  link: string
): Promise<Response> {
  const limpio = link.trim()
  if (limpio.length < 8 || limpio.length > 200) {
    return errorJson(
      404,
      'Este enlace de invitación no es válido o el viaje ya no existe.',
      'invalid_link'
    )
  }

  const { data, error } = await supabase.rpc('join_trip', { p_link: limpio })
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('trip_not_found') || msg.includes('invalid_link')) {
      return errorJson(
        404,
        'Este enlace de invitación no es válido o el viaje ya no existe.',
        'invalid_link'
      )
    }
    if (msg.includes('banned')) {
      return errorJson(403, 'Tu cuenta no puede unirse a grupos.', 'banned')
    }
    if (msg.includes('not_authenticated')) {
      return errorJson(
        401,
        'Inicia sesión para unirte al grupo.',
        'unauthorized'
      )
    }
    if (esFaltaDeEsquema(error)) {
      return errorJson(
        503,
        'Los viajes en grupo no están disponibles en este momento. Inténtalo más tarde.',
        'groups_unavailable'
      )
    }
    return errorDb(error, 'groups.join_trip')
  }

  const tripId = typeof data === 'string' && esUuid(data) ? data : null
  if (!tripId) {
    return errorJson(
      500,
      'No pudimos unirte al grupo. Inténtalo de nuevo.',
      'join_failed'
    )
  }

  const { data: member } = await supabase
    .from('trip_members')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .maybeSingle()

  return okJson({ tripId, member: (member as TripMemberRow | null) ?? null })
}
