import { InterpretRequestSchema } from '@/lib/validations/interpret'
import { interpretarDescripcion } from '@/lib/ai/interpret'
import { aiConfigured } from '@/lib/ai/config'
import { describeAiError } from '@/lib/ai/client'
import { bloqueoPorTopeDiario, respuestaTopeDiario } from '@/lib/ai/presupuesto'
import { identificar, limitarIa } from '@/lib/ai/routeKit'
import { LIMITES_INTERPRETAR } from '@/lib/security/aiGuard'

export const maxDuration = 60

/**
 * POST /api/interpret { texto, hoy? } → InterpretResult
 * Convierte la descripción libre del viaje en campos del formulario para
 * prellenarlo y preguntar solo lo que falte.
 *
 * Acepta anónimos (Haiku, barato) con su propio límite por IP. Con el tope
 * global de gasto diario agotado responde 429 code 'tope_diario' (no 503:
 * el cliente no debe dar la función por apagada toda la sesión).
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

  const llamante = await identificar(request)
  const limite = await limitarIa(llamante, 'interpret', LIMITES_INTERPRETAR)
  if (limite) return limite

  const tope = await bloqueoPorTopeDiario()
  if (tope) return tope

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
      userId: llamante.user?.id ?? null,
      signal: request.signal,
    })
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    const { code, mensaje } = describeAiError(err)
    if (code === 'tope_diario') return respuestaTopeDiario()
    return Response.json({ error: mensaje }, { status: 502 })
  }
}
