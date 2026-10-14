import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { describeAiError } from '@/lib/ai/client'
import { aiConfigured } from '@/lib/ai/config'
import {
  calcularHuecos,
  huecoPublico,
  rescheduleActivity,
} from '@/lib/ai/rescheduleActivity'
import {
  estadoPorErrorIA,
  identificar,
  jsonError,
  leerJson,
  limitar,
} from '@/lib/ai/routeKit'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { TripRow } from '@/types/database'

/**
 * POST /api/reschedule — propone un nuevo horario para una actividad perdida.
 *
 * Exige sesión (cookie en la web o `Authorization: Bearer` en el móvil) y lee
 * el viaje guardado con el cliente del usuario (RLS).
 *
 * Body: { activityId: string, tripId: uuid, reason?: string (máx 300) }
 * 200:  { activity: Activity, dia: number, diaOriginal: number, nota: string,
 *         huecos: { dia, desde, hasta }[] }
 *       `activity` conserva id/coords; `dia` es el día (1-based) donde queda.
 */

export const maxDuration = 60

const MAX_BODY_BYTES = 8_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  activityId: z.string().trim().min(1).max(120),
  tripId: z.string().trim().regex(UUID),
  reason: z.string().trim().max(300).optional(),
})

const MOTIVO_POR_DEFECTO = 'El viajero la perdió o no pudo asistir.'

export async function POST(request: Request): Promise<Response> {
  const lectura = await leerJson(request, MAX_BODY_BYTES)
  if (!lectura.ok) return lectura.response

  const parsed = BodySchema.safeParse(lectura.data)
  if (!parsed.success) {
    return jsonError(400, 'Faltan datos para reagendar la actividad.', {
      code: 'bad_request',
    })
  }
  const { activityId, tripId } = parsed.data

  if (!isSupabaseConfigured()) {
    return jsonError(
      503,
      'Reagendar necesita un viaje guardado y ahora mismo no podemos acceder a tus viajes. Inténtalo más tarde.',
      { code: 'no_disponible' }
    )
  }

  const llamante = await identificar(request)
  if (!llamante.user || !llamante.supabase) {
    return jsonError(401, 'Inicia sesión para reagendar actividades.', {
      code: 'auth_required',
    })
  }

  const limite = await limitar(llamante, 'reschedule', {
    conSesion: 30,
    anonimo: 0,
  })
  if (limite) return limite

  // Lectura con la sesión del usuario: la RLS garantiza que el viaje es suyo.
  const { data, error } = await llamante.supabase
    .from('trips')
    .select('id, data')
    .eq('id', tripId)
    .maybeSingle()

  if (error) {
    Sentry.captureException(error, { tags: { area: 'reschedule-load' } })
    return jsonError(
      502,
      'No pudimos cargar tu viaje. Inténtalo de nuevo en unos segundos.',
      { code: 'carga_fallida' }
    )
  }
  const row = data as Pick<TripRow, 'id' | 'data'> | null
  const dias = Array.isArray(row?.data?.dias) ? row.data.dias : null
  if (!row || !dias) {
    return jsonError(404, 'No encontramos ese viaje.', { code: 'not_found' })
  }

  const diaOriginalIndex = dias.findIndex(
    (d) =>
      Array.isArray(d.actividades) &&
      d.actividades.some((a) => a.id === activityId)
  )
  const actividad = dias[diaOriginalIndex]?.actividades.find(
    (a) => a.id === activityId
  )
  if (diaOriginalIndex < 0 || !actividad) {
    return jsonError(404, 'No encontramos esa actividad en tu viaje.', {
      code: 'not_found',
    })
  }

  const huecos = calcularHuecos(dias, actividad, diaOriginalIndex)
  const huecosPublicos = huecos.map(huecoPublico)
  if (huecos.length === 0) {
    return jsonError(
      422,
      'No encontramos un hueco libre en lo que queda del viaje. Prueba a liberar tiempo quitando otra actividad.',
      { code: 'sin_huecos', huecos: [] }
    )
  }

  if (!aiConfigured()) {
    return jsonError(
      503,
      'La sugerencia automática no está disponible ahora mismo. Puedes mover la actividad a uno de los huecos libres.',
      { code: 'ia_no_disponible', huecos: huecosPublicos }
    )
  }

  try {
    const resultado = await rescheduleActivity({
      actividad,
      diaOriginalIndex,
      motivo: parsed.data.reason || MOTIVO_POR_DEFECTO,
      huecos,
      destino: typeof row.data.destino === 'string' ? row.data.destino : '',
      userId: llamante.user.id,
      signal: request.signal,
    })
    return Response.json({ ...resultado, huecos: huecosPublicos })
  } catch (err) {
    const { code } = describeAiError(err)
    if (code === 'unknown') {
      Sentry.captureException(err, { tags: { area: 'reschedule-ai' } })
    }
    return jsonError(
      estadoPorErrorIA(code),
      'No pudimos proponer un nuevo horario ahora mismo. Inténtalo de nuevo en unos segundos o mueve la actividad a un hueco libre.',
      { code, huecos: huecosPublicos }
    )
  }
}
