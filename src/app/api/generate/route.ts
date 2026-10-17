import { TripFormSchema } from '@/lib/validations/tripForm'
import { generateTrips, GenerationError } from '@/lib/ai/generateTrips'
import { respuestaTopeDiario } from '@/lib/ai/presupuesto'
import { exigirSesion, leerJson, limitarIa } from '@/lib/ai/routeKit'
import { LIMITES_GENERAR } from '@/lib/security/aiGuard'
import {
  comprobarTopeGenerar,
  MAX_BODY_GENERAR,
  pideNoCache,
} from './_lib/comun'

// Los viajes largos se generan en bloques paralelos; aun así dejamos margen
// (con Fluid Compute de Vercel el máximo en Hobby es 300 s).
export const maxDuration = 300

// Re-exportado aquí por compatibilidad: varios módulos importan el tipo desde
// la ruta. La lógica vive en @/lib/ai/generateTrips (reutilizada por el stream).
export type { GenerateResult } from '@/lib/ai/generateTrips'

/**
 * POST /api/generate — genera el itinerario (versión sin streaming).
 *
 * Exige sesión (cookie o Bearer), con límites por cuenta por hora y por día
 * (compartidos con /api/generate/stream) y el tope global de gasto diario.
 */
export async function POST(request: Request): Promise<Response> {
  const sesion = await exigirSesion(request)
  if (!sesion.ok) return sesion.response

  const lectura = await leerJson(request, MAX_BODY_GENERAR)
  if (!lectura.ok) return lectura.response
  const body = lectura.data
  const parsed = TripFormSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      {
        error: 'Revisa los datos del viaje',
        campos: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const limite = await limitarIa(sesion.llamante, 'generate', LIMITES_GENERAR)
  if (limite) return limite

  // Permite forzar regeneración ("Otra versión") saltando la caché.
  const noCache = pideNoCache(body)

  const tope = await comprobarTopeGenerar(parsed.data, noCache)
  if (tope) return tope

  try {
    const { result, cacheHit, demo } = await generateTrips(parsed.data, {
      noCache,
      signal: request.signal,
      userId: sesion.llamante.user?.id ?? null,
    })
    return Response.json(result, {
      headers: {
        'X-Cache': cacheHit ? 'HIT' : 'MISS',
        'X-Demo': demo ? '1' : '0',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    if (err instanceof GenerationError) {
      // Corte duro del tope a mitad de la generación (aiGenerate).
      if (err.code === 'tope_diario') return respuestaTopeDiario()
      return Response.json(
        { error: err.mensaje, code: err.code },
        { status: err.code === 'rate_limit' ? 503 : 502 }
      )
    }
    return Response.json(
      { error: 'No pudimos generar tu viaje. Inténtalo de nuevo.' },
      { status: 500 }
    )
  }
}
