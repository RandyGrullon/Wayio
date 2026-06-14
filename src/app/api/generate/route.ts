import { TripFormSchema } from '@/lib/validations/tripForm'
import { generateTrips } from '@/lib/ai/generateTrips'

export const maxDuration = 60

// Re-exportado aquí por compatibilidad: varios módulos importan el tipo desde
// la ruta. La lógica vive en @/lib/ai/generateTrips (reutilizada por el stream).
export type { GenerateResult } from '@/lib/ai/generateTrips'

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json()
  const parsed = TripFormSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Permite forzar regeneración ("Otra versión") saltando la caché.
  const noCache =
    typeof body === 'object' && body !== null && 'noCache' in body
      ? Boolean((body as { noCache?: unknown }).noCache)
      : false

  const { result, cacheHit, demo } = await generateTrips(parsed.data, {
    noCache,
  })

  return new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      'X-Cache': cacheHit ? 'HIT' : 'MISS',
      'X-Demo': demo ? (result.motivo ? 'fallback' : '1') : '0',
    },
  })
}
