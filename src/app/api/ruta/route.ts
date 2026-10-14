import { z } from 'zod'
import { calcularRutas } from '@/lib/api/rutas'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/security/rateLimit'

export const maxDuration = 60

const Punto = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
])

const Body = z.object({
  tramos: z
    .array(
      z.object({
        desde: Punto,
        hasta: Punto,
        modo: z.enum(['pie', 'auto', 'directo']).optional(),
      })
    )
    .min(1)
    .max(80),
})

/**
 * POST /api/ruta { tramos: [{ desde: [lng, lat], hasta: [lng, lat], modo? }] }
 * → { tramos: [{ coords, distancia (m), duracion (s), modo, fuente }] }
 *
 * Rutas reales por calles (a pie o en carro) entre paradas del itinerario.
 * Si el servicio de rutas no responde, cada tramo vuelve como estimación en
 * línea directa (fuente 'estimado').
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Tramos inválidos' }, { status: 400 })
  }

  if (
    process.env.NODE_ENV === 'production' ||
    process.env['RATE_LIMIT_ENFORCE'] === 'true'
  ) {
    const r = await rateLimit({
      bucket: 'ruta',
      id: `ip:${clientIp(request)}`,
      limit: 120,
      windowSec: 600,
    })
    if (!r.ok) return tooManyRequests(r)
  }

  const tramos = await calcularRutas(
    parsed.data.tramos.map((t) => ({
      desde: t.desde,
      hasta: t.hasta,
      ...(t.modo ? { modo: t.modo } : {}),
    }))
  )
  return Response.json(
    { tramos },
    { headers: { 'Cache-Control': 'private, max-age=3600' } }
  )
}
