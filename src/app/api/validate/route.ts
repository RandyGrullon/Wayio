import { z } from 'zod'
import { aiConfigured } from '@/lib/ai/config'
import {
  dentroDelLimite,
  identificar,
  jsonError,
  leerJson,
  limitar,
} from '@/lib/ai/routeKit'
import {
  claveValidacion,
  conflictosConIA,
  conflictosIACacheados,
  detectarConflictosLocales,
} from '@/lib/ai/validateSchedule'
import type { Conflict } from '@/types/conflicts'
import type { Day } from '@/types/trip'

/**
 * POST /api/validate — conflictos del itinerario.
 *
 * Body: { dias: Day[], ia?: boolean }
 * 200:  { conflicts: Conflict[], ia: { estado: EstadoIA } }
 *
 * - Las reglas locales se aplican SIEMPRE (gratis y al instante).
 * - La pasada de IA solo si `ia: true` (bajo demanda, no en cada render):
 *   con caché por hash del itinerario (10 min) y rate limit propio. Si la IA
 *   no está disponible, falla o se superó el límite, se devuelven igualmente
 *   los conflictos locales y `ia.estado` lo indica.
 */

export const maxDuration = 60

type EstadoIA =
  | 'no_solicitada'
  | 'ok'
  | 'cache'
  | 'no_disponible'
  | 'limite'
  | 'error'

const MAX_BODY_BYTES = 400_000

const BodySchema = z.object({
  dias: z
    .array(
      z.looseObject({
        actividades: z
          .array(z.looseObject({ id: z.string().min(1).max(120) }))
          .max(40),
      })
    )
    .max(60),
  ia: z.boolean().optional(),
})

const respuesta = (conflicts: Conflict[], estado: EstadoIA): Response =>
  Response.json({ conflicts, ia: { estado } })

export async function POST(request: Request): Promise<Response> {
  const lectura = await leerJson(request, MAX_BODY_BYTES)
  if (!lectura.ok) return lectura.response

  const parsed = BodySchema.safeParse(lectura.data)
  if (!parsed.success) {
    return jsonError(400, 'No pudimos revisar este itinerario.', {
      code: 'bad_request',
    })
  }
  const dias = parsed.data.dias as unknown as Day[]

  const llamante = await identificar(request)
  const limite = await limitar(llamante, 'validate', {
    conSesion: 600,
    anonimo: 300,
  })
  if (limite) return limite

  const locales = detectarConflictosLocales(dias)
  if (!parsed.data.ia) return respuesta(locales, 'no_solicitada')
  if (!aiConfigured()) return respuesta(locales, 'no_disponible')

  const clave = claveValidacion(dias)
  const cacheados = conflictosIACacheados(dias, clave)
  if (cacheados) return respuesta([...locales, ...cacheados], 'cache')

  // La pasada de IA tiene su propio límite; superarlo no rompe la validación.
  const puede = await dentroDelLimite(llamante, 'validate-ia', {
    conSesion: 30,
    anonimo: 10,
  })
  if (!puede) return respuesta(locales, 'limite')

  try {
    const deIA = await conflictosConIA(dias, clave, {
      userId: llamante.user?.id ?? null,
      signal: request.signal,
    })
    return respuesta([...locales, ...deIA], 'ok')
  } catch {
    // Best-effort: los conflictos locales siguen siendo válidos.
    return respuesta(locales, 'error')
  }
}
