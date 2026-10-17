import { z } from 'zod'
import { calcularRutas } from '@/lib/api/rutas'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/security/rateLimit'

export const maxDuration = 60

/** Peticiones por IP y ventana (con cualquier proveedor). */
const LIMITE = { limit: 120, windowSec: 600 }
/**
 * Créditos de Geoapify que puede gastar cada IP por ventana: solo cuentan los
 * tramos que de verdad se piden al proveedor (no los que salen de la caché).
 * El total diario de la app lo acota además GEOAPIFY_CREDITOS_DIA.
 */
const CREDITOS_POR_IP = { limit: 300, windowSec: 600 }

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
 * Rutas reales por calles (a pie o en carro) entre paradas del itinerario:
 * con Geoapify si hay GEOAPIFY_API_KEY (fuente 'geoapify') y, si no, con OSRM
 * (fuente 'osrm'); ver lib/api/rutas.ts. Si el servicio de rutas no responde,
 * cada tramo vuelve como estimación en línea directa (fuente 'estimado'):
 * nunca un error por culpa del proveedor.
 *
 * Con Geoapify cada tramo cuesta un crédito: además del límite de peticiones
 * por IP hay uno de créditos por IP (los tramos que pasan del límite salen
 * estimados, sin error) y, si el cliente se va, no se lanzan las peticiones
 * que aún esperaban turno.
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

  const limitar =
    process.env.NODE_ENV === 'production' ||
    process.env['RATE_LIMIT_ENFORCE'] === 'true'
  const id = `ip:${clientIp(request)}`
  if (limitar) {
    const r = await rateLimit({ bucket: 'ruta', id, ...LIMITE })
    if (!r.ok) return tooManyRequests(r)
  }

  const tramos = await calcularRutas(
    parsed.data.tramos.map((t) => ({
      desde: t.desde,
      hasta: t.hasta,
      ...(t.modo ? { modo: t.modo } : {}),
    })),
    {
      signal: request.signal,
      ...(limitar
        ? {
            autorizarCreditos: async (creditos: number) =>
              (
                await rateLimit({
                  bucket: 'ruta-creditos',
                  id,
                  ...CREDITOS_POR_IP,
                  coste: creditos,
                })
              ).ok,
          }
        : {}),
    }
  )
  return Response.json(
    { tramos },
    { headers: { 'Cache-Control': 'private, max-age=3600' } }
  )
}
