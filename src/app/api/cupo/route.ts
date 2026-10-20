import { CUPO_GRATIS, type AccionConCupo } from '@/constants/planes'
import { identificar, jsonError, limitar } from '@/lib/ai/routeKit'
import {
  ACCIONES_CON_CUPO,
  leerTier,
  leerUsoDelMes,
  periodoRD,
  tieneNivel,
} from '@/lib/planes/cupo'
import { createAdminClientSafe } from '@/lib/supabase/admin'

/**
 * GET /api/cupo — plan efectivo y uso del cupo mensual del plan Gratis.
 * Acepta la sesión por cookies (web) o `Authorization: Bearer` (móvil).
 *
 * 200: {
 *   tier: 'free' | 'pro' | 'grupo' | null,   // null = no se pudo leer el plan
 *   cupos: {
 *     generar:  { usados, limite },
 *     ajustar:  { usados, limite },
 *     analizar: { usados, limite },
 *   } | null,                                  // null en Pro y Grupo: sin límite
 *   renueva: 'YYYY-MM-DD',                     // día 1 del mes siguiente (RD)
 *   aproximado?: true,                         // no se pudo leer el uso: usados 0
 * }
 * 401: { error, code: 'auth_required' }
 *
 * `usados` nunca pasa de `limite` (si se gastó más siendo Pro, el cupo de
 * Gratis cuenta como agotado). El uso se lee con el cliente del usuario (la
 * RLS le deja ver solo sus filas) o, si no lo hay, con la service role.
 */

const NO_STORE = { 'Cache-Control': 'private, no-store' }

type Cupos = Record<AccionConCupo, { usados: number; limite: number }>

export async function GET(request: Request): Promise<Response> {
  const llamante = await identificar(request)
  const user = llamante.user
  if (!user) {
    return jsonError(
      401,
      'Inicia sesión para ver tu plan y tu cupo.',
      { code: 'auth_required' },
      NO_STORE
    )
  }

  const limite = await limitar(llamante, 'cupo', {
    conSesion: 120,
    anonimo: 0,
  })
  if (limite) return limite

  const { periodo, renueva } = periodoRD()
  const tier = await leerTier(user.id)
  if (tier !== null && tieneNivel(tier, 'pro')) {
    return Response.json({ tier, cupos: null, renueva }, { headers: NO_STORE })
  }

  const cliente = llamante.supabase ?? createAdminClientSafe()
  const uso = cliente ? await leerUsoDelMes(cliente, user.id, periodo) : null

  const cupos = {} as Cupos
  for (const accion of ACCIONES_CON_CUPO) {
    const max = CUPO_GRATIS[accion]
    cupos[accion] = { usados: Math.min(uso?.[accion] ?? 0, max), limite: max }
  }

  return Response.json(
    { tier, cupos, renueva, ...(uso ? {} : { aproximado: true }) },
    { headers: NO_STORE }
  )
}
