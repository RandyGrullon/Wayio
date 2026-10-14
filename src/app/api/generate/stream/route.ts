import { TripFormSchema } from '@/lib/validations/tripForm'
import { generateTrips, GenerationError } from '@/lib/ai/generateTrips'
import { guardAi, LIMITES_GENERACION } from '@/lib/security/aiGuard'

export const maxDuration = 300

/**
 * Versión en streaming de /api/generate. Emite eventos SSE con el progreso real
 * del backend (contexto → plan → días → coordenadas → listo) y al final el
 * resultado. Si el cliente cierra la conexión se cancela la generación (y se
 * deja de pagar por los tokens).
 *
 * Formato de cada evento (línea `data:` de SSE):
 *   { type: 'progress', fase, label, progreso? }
 *   { type: 'result', result, demo }
 *   { type: 'error', message, code }
 * Cada 15 s se envía un comentario ": ping" para que proxies no corten.
 */
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

  const noCache =
    typeof body === 'object' && body !== null && 'noCache' in body
      ? Boolean((body as { noCache?: unknown }).noCache)
      : false

  const encoder = new TextEncoder()
  const abort = new AbortController()
  request.signal.addEventListener('abort', () => abort.abort(), { once: true })

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let cerrado = false
      const write = (chunk: string): void => {
        if (cerrado) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          cerrado = true
        }
      }
      const send = (obj: unknown): void =>
        write(`data: ${JSON.stringify(obj)}\n\n`)
      const ping = setInterval(() => write(': ping\n\n'), 15_000)

      try {
        const { result, demo } = await generateTrips(parsed.data, {
          noCache,
          signal: abort.signal,
          userId: guard.userId,
          onProgress: (p) => send({ type: 'progress', ...p }),
        })
        send({ type: 'result', result, demo })
      } catch (err) {
        if (!abort.signal.aborted) {
          send({
            type: 'error',
            message:
              err instanceof GenerationError
                ? err.mensaje
                : 'No pudimos generar tu viaje. Inténtalo de nuevo.',
            code: err instanceof GenerationError ? err.code : 'unknown',
          })
        }
      } finally {
        clearInterval(ping)
        cerrado = true
        try {
          controller.close()
        } catch {
          // ya cerrado
        }
      }
    },
    cancel() {
      abort.abort()
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
