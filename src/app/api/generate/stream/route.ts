import { TripFormSchema } from '@/lib/validations/tripForm'
import { generateTrips, GenerationError } from '@/lib/ai/generateTrips'
import { exigirSesion, leerJson, limitarIa } from '@/lib/ai/routeKit'
import { LIMITES_GENERAR } from '@/lib/security/aiGuard'
import {
  comprobarTopeGenerar,
  MAX_BODY_GENERAR,
  pideNoCache,
} from '../_lib/comun'

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
 *
 * Sesión, límites por cuenta (los de /api/generate) y tope diario se
 * comprueban ANTES de abrir el stream, para responder con su status real
 * (401/429) en JSON. Si el tope salta a mitad (corte duro de aiGenerate),
 * llega como evento { type: 'error', code: 'tope_diario' }.
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

  const noCache = pideNoCache(body)

  const tope = await comprobarTopeGenerar(parsed.data, noCache)
  if (tope) return tope
  const userId = sesion.llamante.user?.id ?? null

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
          userId,
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
            // Incluye 'tope_diario' si saltó el corte duro de aiGenerate.
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
