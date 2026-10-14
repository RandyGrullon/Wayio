/** Supabase CRUD for trips — the mobile equivalent of the web /api/trips routes. */
import { getSupabase } from '../supabase/client'
import type {
  PlanningTrip,
  PlanningActivity,
  TripRow,
} from '../../types/planning'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Viajes propios Y aquellos en los que soy miembro de su grupo (la RLS
 * trips_select deja ver ambos). No se filtra solo por user_id: un invitado
 * no vería nunca el viaje al que se unió.
 */
export async function listTrips(): Promise<TripRow[]> {
  const supabase = getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: miembros } = await supabase
    .from('trip_members')
    .select('trip_id')
    .eq('user_id', user.id)
    .limit(150)

  const ids = [
    ...new Set(
      ((miembros ?? []) as { trip_id: unknown }[])
        .map((m) => m.trip_id)
        .filter((v): v is string => typeof v === 'string' && UUID_RE.test(v))
    ),
  ]

  const base = supabase.from('trips').select('*')
  const filtrado =
    ids.length > 0
      ? base.or(`user_id.eq.${user.id},id.in.(${ids.join(',')})`)
      : base.eq('user_id', user.id)

  const { data, error } = await filtrado
    .order('created_at', { ascending: false })
    .limit(200)

  if (error)
    throw new Error('No pudimos cargar tus viajes. Inténtalo de nuevo.')
  return (data ?? []) as TripRow[]
}

export async function getTrip(id: string): Promise<TripRow | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return data as TripRow
}

export async function createTrip(trip: PlanningTrip): Promise<TripRow> {
  const supabase = getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Inicia sesión para guardar tu viaje.')

  // El enlace de invitación lo genera la BD (default gen_random_uuid());
  // solo se envía si el dispositivo tiene un generador seguro. Nunca un
  // valor adivinable como Date.now().
  const link = globalThis.crypto?.randomUUID?.()

  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: user.id,
      data: trip,
      paquete: trip.paquete,
      ...(link ? { grupo_link: link } : {}),
      estado: 'planificando',
      actividades_pendientes: [],
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error('No pudimos guardar el viaje. Inténtalo de nuevo.')
  }
  // El trigger de la BD ya da de alta al dueño como miembro del grupo.
  return data as TripRow
}

/** Actualiza el viaje (solo el dueño: la RLS rechaza a los demás). */
export async function updateTrip(
  id: string,
  patch: { data?: PlanningTrip; actividades_pendientes?: PlanningActivity[] }
): Promise<void> {
  const supabase = getSupabase()
  const update: Record<string, unknown> = {}
  if (patch.data !== undefined) update['data'] = patch.data
  if (patch.actividades_pendientes !== undefined)
    update['actividades_pendientes'] = patch.actividades_pendientes
  if (Object.keys(update).length === 0) return

  const { data, error } = await supabase
    .from('trips')
    .update(update)
    .eq('id', id)
    .select('id')
  if (error) {
    throw new Error('No pudimos guardar los cambios. Inténtalo de nuevo.')
  }
  if (!data || data.length === 0) {
    throw new Error('Solo quien creó el viaje puede editarlo.')
  }
}

/**
 * Se une al viaje en grupo de un enlace de invitación (wayio://group/<link>
 * o https://.../group/<link>). Devuelve el id del viaje. Usa la RPC
 * join_trip, que valida el enlace en la BD.
 */
export async function joinTripByLink(link: string): Promise<string> {
  const limpio = link.trim()
  if (limpio.length < 8 || limpio.length > 200) {
    throw new Error('Este enlace de invitación no es válido.')
  }
  const { data, error } = await getSupabase().rpc('join_trip', {
    p_link: limpio,
  })
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('trip_not_found') || msg.includes('invalid_link')) {
      throw new Error(
        'Este enlace de invitación no es válido o el viaje ya no existe.'
      )
    }
    if (msg.includes('not_authenticated')) {
      throw new Error('Inicia sesión para unirte al grupo.')
    }
    if (msg.includes('banned')) {
      throw new Error('Tu cuenta no puede unirse a grupos.')
    }
    throw new Error('No pudimos unirte al grupo. Inténtalo de nuevo.')
  }
  if (typeof data !== 'string' || !UUID_RE.test(data)) {
    throw new Error('No pudimos unirte al grupo. Inténtalo de nuevo.')
  }
  return data
}

/** Publica u oculta el viaje en la vista compartida (solo el dueño). */
export async function setTripPublic(
  id: string,
  isPublic: boolean
): Promise<void> {
  const { data, error } = await getSupabase()
    .from('trips')
    .update({ is_public: isPublic })
    .eq('id', id)
    .select('id')
  if (error) {
    throw new Error('No pudimos cambiar cómo se comparte el viaje.')
  }
  if (!data || data.length === 0) {
    throw new Error('Solo quien creó el viaje puede compartirlo.')
  }
}

/** Borra el viaje (solo el dueño). */
export async function deleteTrip(id: string): Promise<void> {
  const { data, error } = await getSupabase()
    .from('trips')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) throw new Error('No pudimos borrar el viaje. Inténtalo de nuevo.')
  if (!data || data.length === 0) {
    throw new Error('Solo quien creó el viaje puede borrarlo.')
  }
}
