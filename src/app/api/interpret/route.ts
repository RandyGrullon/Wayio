import { InterpretRequestSchema } from '@/lib/validations/interpret'
import { interpretarDescripcion } from '@/lib/ai/interpret'
import { aiConfigured } from '@/lib/ai/config'
import { describeAiError } from '@/lib/ai/client'
import { guardAi, LIMITES_INTERPRETACION } from '@/lib/security/aiGuard'

export const maxDuration = 60

/**
 * POST /api/interpret { texto, hoy? } → InterpretResult
 * Convierte la descripción libre del viaje en campos del formulario para
 * prellenarlo y preguntar solo lo que falte.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const parsed = InterpretRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Cuéntanos un poco más de tu viaje (mínimo unas palabras).' },
      { status: 400 }
    )
  }
  if (!aiConfigured()) {
    return Response.json(
      {
        error:
          'La interpretación automática no está disponible ahora mismo. Rellena los datos a mano.',
      },
      { status: 503 }
    )
  }

  const guard = await guardAi(request, 'interpret', LIMITES_INTERPRETACION)
  if ('blocked' in guard) return guard.blocked

  // "hoy" del usuario (su zona horaria) si lo manda; si no, el del servidor.
  const hoyServidor = new Date().toISOString().slice(0, 10)
  const hoy =
    parsed.data.hoy &&
    Math.abs(Date.parse(parsed.data.hoy) - Date.parse(hoyServidor)) <=
      2 * 86_400_000
      ? parsed.data.hoy
      : hoyServidor

  try {
    const result = await interpretarDescripcion(parsed.data.texto, hoy, {
      userId: guard.userId,
      signal: request.signal,
    })
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    const { mensaje } = describeAiError(err)
    return Response.json({ error: mensaje }, { status: 502 })
  }
}
