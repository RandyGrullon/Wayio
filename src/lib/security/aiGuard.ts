import 'server-only'
import { getRequestUser } from '@/lib/supabase/request'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/security/rateLimit'

/** Límites de generación de itinerarios por hora. */
export const LIMITES_GENERACION = { anonimo: 6, usuario: 30, windowSec: 3600 }

/** Límites de interpretación de texto libre (barata y rápida). */
export const LIMITES_INTERPRETACION = {
  anonimo: 30,
  usuario: 120,
  windowSec: 3600,
}

/**
 * Freno común para las rutas de IA: identifica al usuario (si hay sesión) y
 * aplica un límite por usuario o por IP. En desarrollo no limita (salvo
 * RATE_LIMIT_ENFORCE=true) para poder correr la batería de evaluación.
 *
 * Devuelve la Response 429 si se excede, o el userId (o null) si puede seguir.
 */
export async function guardAi(
  request: Request,
  bucket: string,
  limites: { anonimo: number; usuario: number; windowSec: number }
): Promise<{ blocked: Response } | { userId: string | null }> {
  let userId: string | null = null
  try {
    userId = (await getRequestUser(request))?.id ?? null
  } catch {
    userId = null
  }
  const enforce =
    process.env.NODE_ENV === 'production' ||
    process.env['RATE_LIMIT_ENFORCE'] === 'true'
  if (!enforce) return { userId }

  const r = await rateLimit({
    bucket,
    id: userId ?? `ip:${clientIp(request)}`,
    limit: userId ? limites.usuario : limites.anonimo,
    windowSec: limites.windowSec,
  })
  return r.ok ? { userId } : { blocked: tooManyRequests(r) }
}
