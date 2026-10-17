import 'server-only'
import { aiConfigured } from '@/lib/ai/config'
import { estadoPresupuesto, respuestaTopeDiario } from '@/lib/ai/presupuesto'
import { getCachedTrip } from '@/lib/cache/tripCache'
import type { TripForm } from '@/lib/validations/tripForm'

/**
 * Piezas comunes de /api/generate y /api/generate/stream.
 */

/**
 * Tope del body: el formulario del viaje (con su descripción libre) cabe de
 * sobra en 64 KB; antes se leía con request.json() sin límite.
 */
export const MAX_BODY_GENERAR = 64_000

/** "Otra versión" manda noCache: true para saltarse la caché. */
export function pideNoCache(body: unknown): boolean {
  return typeof body === 'object' && body !== null && 'noCache' in body
    ? Boolean((body as { noCache?: unknown }).noCache)
    : false
}

/**
 * Comprueba el tope global de gasto diario antes de generar. Devuelve la
 * respuesta 429 (code 'tope_diario') o null si se puede seguir.
 *
 * - Sin IA configurada (modo demo) no hay gasto: nunca bloquea.
 * - Con el tope agotado, un viaje que ya está en la caché sigue saliendo
 *   (no cuesta nada): solo se corta lo que obligaría a llamar a la IA.
 */
export async function comprobarTopeGenerar(
  form: TripForm,
  noCache: boolean
): Promise<Response | null> {
  if (!aiConfigured()) return null
  const estado = await estadoPresupuesto()
  if (!estado.agotado) return null
  if (!noCache && (await getCachedTrip(form))) return null
  return respuestaTopeDiario(estado)
}
