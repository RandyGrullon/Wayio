import 'server-only'
import { aiConfigured } from '@/lib/ai/config'
import { estadoPresupuesto, respuestaTopeDiario } from '@/lib/ai/presupuesto'
import type { Llamante } from '@/lib/ai/routeKit'
import { getCachedTrip } from '@/lib/cache/tripCache'
import { exigirCupo, sinConsumo, type ResultadoCupo } from '@/lib/planes/cupo'
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

/**
 * Consume una unidad del cupo mensual de «generar» (plan Gratis; en Pro solo
 * cuenta). Va DESPUÉS de la sesión, los límites por cuenta y el tope diario,
 * y antes de llamar a la IA. Devuelve el 402 'cupo_agotado' o la reserva,
 * cuya `devolver()` debe llamar la ruta si la generación falla, se cancela o
 * el resultado sale de la caché o del modo demo.
 *
 * - Sin IA configurada (modo demo) no hay gasto: no se cuenta.
 * - Con el cupo agotado, un viaje que ya está en la caché sale igual (no
 *   cuesta nada): solo se corta lo que obligaría a llamar a la IA, igual que
 *   con el tope diario.
 */
export async function reservarCupoGenerar(
  llamante: Llamante,
  form: TripForm,
  noCache: boolean
): Promise<ResultadoCupo> {
  if (!aiConfigured()) return sinConsumo()
  const cupo = await exigirCupo(llamante, 'generar')
  if (cupo.ok || noCache) return cupo
  return (await getCachedTrip(form)) ? sinConsumo() : cupo
}
