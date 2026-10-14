import {
  autenticar,
  campo,
  errorDb,
  errorJson,
  esUuid,
  leerJson,
  okJson,
} from './_lib/http'
import { MAX_TRIP_BYTES, parsearTrip } from './_lib/tripSchema'
import { rateLimit, tooManyRequests } from '@/lib/security/rateLimit'
import type { TripRow } from '@/types/database'

/**
 * POST /api/trips — guarda un viaje del usuario.
 * Body: { trip: Trip }. Respuesta 201: { trip: TripRow }.
 *
 * El Trip se sanea y valida (longitudes, lat/lng numéricos, arrays acotados,
 * sin HTML) antes de guardarlo. El dueño queda como miembro del grupo del
 * viaje (trigger trg_trips_owner_member en la BD + join_trip idempotente).
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  // Bucket propio: las ediciones (PUT) no deben agotar el cupo de creación.
  const limite = await rateLimit({
    bucket: 'trips-create',
    id: user.id,
    limit: 30,
    windowSec: 600,
  })
  if (!limite.ok) return tooManyRequests(limite)

  const leido = await leerJson(request, MAX_TRIP_BYTES)
  if (!leido.ok) return leido.response

  const parsed = parsearTrip(campo(leido.body, 'trip'))
  if (!parsed.ok) {
    return errorJson(
      400,
      'Este viaje tiene datos que no pudimos guardar. Vuelve a generarlo e inténtalo de nuevo.',
      'invalid_trip',
      { detalles: parsed.detalles }
    )
  }

  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: user.id,
      data: parsed.trip,
      paquete: parsed.trip.paquete,
      // La BD también lo genera por defecto; se envía para no depender de ello.
      grupo_link: crypto.randomUUID(),
      estado: 'planificando',
      actividades_pendientes: [],
    })
    .select()
    .single()

  if (error || !data) return errorDb(error, 'trips.insert')
  const row = data as TripRow

  // El trigger ya añade al dueño a trip_members; esta llamada idempotente lo
  // garantiza aunque el trigger faltara. Si falla no rompe el guardado.
  if (row.grupo_link) {
    await supabase.rpc('join_trip', { p_link: row.grupo_link })
  }

  return okJson({ trip: row }, 201)
}

/**
 * GET /api/trips — viajes propios y aquellos en los que soy miembro.
 * Respuesta: { trips: TripRow[] } (más recientes primero).
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  // Viajes de los que soy miembro (RLS: solo veo mis propias filas aquí).
  const { data: miembros } = await supabase
    .from('trip_members')
    .select('trip_id')
    .eq('user_id', user.id)
    .limit(150)

  const ids = [
    ...new Set(
      ((miembros ?? []) as { trip_id: unknown }[])
        .map((m) => m.trip_id)
        .filter(esUuid)
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

  if (error) return errorDb(error, 'trips.list')
  return okJson({ trips: (data ?? []) as TripRow[] })
}
