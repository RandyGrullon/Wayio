import { TripFormSchema } from '@/lib/validations/tripForm'
import { generateTrips, GenerationError } from '@/lib/ai/generateTrips'
import { guardAi, LIMITES_GENERACION } from '@/lib/security/aiGuard'

// Los viajes largos se generan en bloques paralelos; aun así dejamos margen
// (con Fluid Compute de Vercel el máximo en Hobby es 300 s).
export const maxDuration = 300

// Re-exportado aquí por compatibilidad: varios módulos importan el tipo desde
// la ruta. La lógica vive en @/lib/ai/generateTrips (reutilizada por el stream).
export type { GenerateResult } from '@/lib/ai/generateTrips'

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
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

  const guard = await guardAi(request, 'generate', LIMITES_GENERACION)
  if ('blocked' in guard) return guard.blocked

  // Permite forzar regeneración ("Otra versión") saltando la caché.
  const noCache =
    typeof body === 'object' && body !== null && 'noCache' in body
      ? Boolean((body as { noCache?: unknown }).noCache)
      : false

  try {
    const { result, cacheHit, demo } = await generateTrips(parsed.data, {
      noCache,
      signal: request.signal,
      userId: guard.userId,
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
