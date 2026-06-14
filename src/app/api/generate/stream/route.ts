import { TripFormSchema } from '@/lib/validations/tripForm'
import { generateTrips } from '@/lib/ai/generateTrips'

export const maxDuration = 60

/**
 * Versión en streaming de /api/generate. Emite eventos SSE con el progreso real
 * del backend (clima → IA → coordenadas → listo) en vez del loader cronometrado
 * y al final manda el resultado completo. El cliente cae a /api/generate si el
 * streaming falla, así que esta ruta es puramente una mejora de UX.
 *
 * Formato de cada evento (línea `data:` de SSE):
 *   { type: 'progress', fase, label }
 *   { type: 'result', result }
 *   { type: 'error', message }
 */
export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json()
  const parsed = TripFormSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const noCache =
    typeof body === 'object' && body !== null && 'noCache' in body
      ? Boolean((body as { noCache?: unknown }).noCache)
      : false

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown): void => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      try {
        const { result } = await generateTrips(parsed.data, {
          noCache,
          onProgress: (p) => send({ type: 'progress', ...p }),
        })
        send({ type: 'result', result })
      } catch {
        send({
          type: 'error',
          message: 'No se pudo generar el itinerario.',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Evita el buffering de algunos proxies para que el progreso llegue ya.
      'X-Accel-Buffering': 'no',
    },
  })
}
