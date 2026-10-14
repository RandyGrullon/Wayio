import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  autenticar,
  campo,
  errorDb,
  errorJson,
  esFaltaDeEsquema,
  esUuid,
  leerJson,
  okJson,
} from '../_lib/http'
import {
  MAX_TRIP_BYTES,
  parsearActividades,
  parsearTrip,
} from '../_lib/tripSchema'
import { leerViajeCompartido } from '@/app/api/shared/_lib/compartido'
import { getRequestAuth } from '@/lib/supabase/request'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { rateLimit, tooManyRequests } from '@/lib/security/rateLimit'
import type { TripRow } from '@/types/database'

type Ctx = { params: Promise<{ id: string }> }

const NO_ENCONTRADO = 'No encontramos este viaje.'
const ESTADOS_TRIP = ['planificando', 'en_viaje', 'completado'] as const

/**
 * Cuando una escritura del dueño no afectó ninguna fila: ¿el viaje existe y
 * lo ve (es miembro) → 403, o no existe / no lo ve → 404?
 */
async function rechazoNoDueno(
  supabase: SupabaseClient,
  id: string
): Promise<Response> {
  const { data } = await supabase
    .from('trips')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  return data
    ? errorJson(403, 'Solo quien creó el viaje puede hacer esto.', 'not_owner')
    : errorJson(404, NO_ENCONTRADO, 'not_found')
}

/**
 * GET /api/trips/[id]
 *  - Con sesión: la fila completa si eres dueño o miembro (RLS).
 *    Respuesta: { trip: TripRow, esDueno: boolean }
 *  - Sin sesión o sin acceso: SOLO la versión pública si el dueño la marcó
 *    como pública (compatibilidad con /viaje-compartido; lo nuevo es
 *    /api/shared/[id]). Respuesta: { trip: { id, data, is_public: true } }
 */
export async function GET(
  request: Request,
  { params }: Ctx
): Promise<Response> {
  const { id } = await params
  if (!esUuid(id)) return errorJson(404, NO_ENCONTRADO, 'not_found')
  if (!isSupabaseConfigured()) return errorJson(404, NO_ENCONTRADO, 'not_found')

  const { supabase, user } = await getRequestAuth(request)
  if (supabase && user) {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) return errorDb(error, 'trips.get')
    if (data) {
      const row = data as TripRow
      return okJson({ trip: row, esDueno: row.user_id === user.id })
    }
  }

  const compartido = await leerViajeCompartido(id)
  if (compartido && compartido !== 'no_disponible') {
    return okJson({ trip: { id, data: compartido.data, is_public: true } })
  }
  return errorJson(404, NO_ENCONTRADO, 'not_found')
}

/**
 * PUT /api/trips/[id] — el dueño actualiza el viaje.
 * Body: { data?: Trip, estado?: 'planificando'|'en_viaje'|'completado',
 *         actividades_pendientes?: Activity[] }
 * Respuesta: { trip: TripRow }
 */
export async function PUT(
  request: Request,
  { params }: Ctx
): Promise<Response> {
  const { id } = await params
  if (!esUuid(id)) return errorJson(404, NO_ENCONTRADO, 'not_found')

  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const limite = await rateLimit({
    bucket: 'trips-update',
    id: user.id,
    limit: 120,
    windowSec: 600,
  })
  if (!limite.ok) return tooManyRequests(limite)

  const leido = await leerJson(request, MAX_TRIP_BYTES)
  if (!leido.ok) return leido.response
  const body = leido.body

  const update: Record<string, unknown> = {}

  const rawData = campo(body, 'data')
  if (rawData !== undefined) {
    const parsed = parsearTrip(rawData)
    if (!parsed.ok) {
      return errorJson(
        400,
        'Hay datos del viaje que no pudimos guardar. Recarga la página e inténtalo de nuevo.',
        'invalid_trip',
        { detalles: parsed.detalles }
      )
    }
    update['data'] = parsed.trip
    update['paquete'] = parsed.trip.paquete
  }

  const rawEstado = campo(body, 'estado')
  if (rawEstado !== undefined) {
    const estado = z.enum(ESTADOS_TRIP).safeParse(rawEstado)
    if (!estado.success) {
      return errorJson(
        400,
        'El estado del viaje no es válido.',
        'invalid_estado'
      )
    }
    update['estado'] = estado.data
  }

  const rawPendientes = campo(body, 'actividades_pendientes')
  if (rawPendientes !== undefined) {
    const pendientes = parsearActividades(rawPendientes)
    if (!pendientes.ok) {
      return errorJson(
        400,
        'Las actividades pendientes tienen datos que no pudimos guardar.',
        'invalid_pendientes',
        { detalles: pendientes.detalles }
      )
    }
    update['actividades_pendientes'] = pendientes.actividades
  }

  if (Object.keys(update).length === 0) {
    return errorJson(400, 'No hay cambios que guardar.', 'empty_update')
  }

  const { data, error } = await supabase
    .from('trips')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .maybeSingle()

  if (error) return errorDb(error, 'trips.update')
  if (!data) return rechazoNoDueno(supabase, id)
  return okJson({ trip: data as TripRow })
}

const PatchSchema = z.object({ is_public: z.boolean() })

/**
 * PATCH /api/trips/[id] — el dueño publica u oculta el viaje en la vista
 * compartida. Body: { is_public: boolean }.
 * Respuesta: { trip: { id, is_public } }
 */
export async function PATCH(
  request: Request,
  { params }: Ctx
): Promise<Response> {
  const { id } = await params
  if (!esUuid(id)) return errorJson(404, NO_ENCONTRADO, 'not_found')

  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const leido = await leerJson(request, 2_000)
  if (!leido.ok) return leido.response
  const parsed = PatchSchema.safeParse(leido.body)
  if (!parsed.success) {
    return errorJson(400, 'Indica si el viaje es público o no.', 'invalid_body')
  }

  const { data, error } = await supabase
    .from('trips')
    .update({ is_public: parsed.data.is_public })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, is_public')
    .maybeSingle()

  if (error) {
    if (esFaltaDeEsquema(error)) {
      return errorJson(
        503,
        'Compartir viajes todavía no está disponible. Inténtalo más tarde.',
        'share_unavailable'
      )
    }
    return errorDb(error, 'trips.patch')
  }
  if (!data) return rechazoNoDueno(supabase, id)
  return okJson({ trip: data as { id: string; is_public: boolean } })
}

/**
 * DELETE /api/trips/[id] — el dueño borra el viaje (y en cascada su grupo).
 * Respuesta: { ok: true }
 */
export async function DELETE(
  request: Request,
  { params }: Ctx
): Promise<Response> {
  const { id } = await params
  if (!esUuid(id)) return errorJson(404, NO_ENCONTRADO, 'not_found')

  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const { data, error } = await supabase
    .from('trips')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')

  if (error) return errorDb(error, 'trips.delete')
  if (!data || data.length === 0) return rechazoNoDueno(supabase, id)
  return okJson({ ok: true })
}
