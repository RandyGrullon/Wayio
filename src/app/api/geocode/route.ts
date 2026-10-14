import { z } from 'zod'
import { geocode, type GeoPoint } from '@/lib/api/geocode'
import { clientIp, rateLimit } from '@/lib/security/rateLimit'

/**
 * POST /api/geocode  { items: [{ nombre, ciudad? }] }  (máx. 10 por petición)
 *  → { results: ({ lat, lng } | null)[] }   (mismo orden que `items`)
 *
 * Geocodificación en lote para el cliente: la pantalla de resultado la usa
 * para completar las coordenadas de las actividades que el servidor no
 * verificó. Nominatim admite como máximo 1 petición/segundo por aplicación;
 * el ritmo (cola + candado global) lo impone lib/api/geocode.ts, y aquí se
 * limita cuánto puede pedir cada IP para que nadie lo use como proxy.
 */

export const maxDuration = 60

/** Lugares por petición (≈ 1,1 s cada uno en Nominatim). */
const MAX_ITEMS = 10
/** Peticiones por IP y ventana. */
const LIMITE = { limit: 30, windowSec: 10 * 60 }
/** Radio alrededor de la ciudad dentro del que debe estar el lugar. */
const RADIO_KM = 60

const BodySchema = z.object({
  items: z
    .array(
      z.object({
        nombre: z.string().trim().max(200),
        ciudad: z.string().trim().max(120).optional(),
      })
    )
    .max(MAX_ITEMS),
})

export async function POST(request: Request): Promise<Response> {
  const limite = await rateLimit({
    bucket: 'geocode',
    id: `ip:${clientIp(request)}`,
    ...LIMITE,
  })
  if (!limite.ok) {
    return Response.json(
      {
        error:
          'Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.',
        retryAfter: limite.retryAfter,
      },
      { status: 429, headers: { 'Retry-After': String(limite.retryAfter) } }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Solicitud no válida.' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      {
        error: `Envía como máximo ${MAX_ITEMS} lugares, cada uno con su nombre.`,
      },
      { status: 400 }
    )
  }

  // Ancla por ciudad (cacheada en geocode.ts): restringe la búsqueda de cada
  // lugar a su entorno para no poner pines en otro país.
  const anclas = new Map<string, GeoPoint | null>()
  const anclaDe = async (ciudad: string): Promise<GeoPoint | null> => {
    const clave = ciudad.toLowerCase()
    if (!anclas.has(clave)) anclas.set(clave, await geocode(ciudad))
    return anclas.get(clave) ?? null
  }

  const results: ({ lat: number; lng: number } | null)[] = []
  for (const { nombre, ciudad } of parsed.data.items) {
    if (!nombre) {
      results.push(null)
      continue
    }
    try {
      const ancla = ciudad ? await anclaDe(ciudad) : null
      const punto = ancla
        ? await geocode(`${nombre}, ${ciudad}`, {
            near: { lat: ancla.lat, lng: ancla.lng },
            radiusKm: RADIO_KM,
          })
        : await geocode(ciudad ? `${nombre}, ${ciudad}` : nombre)
      results.push(punto ? { lat: punto.lat, lng: punto.lng } : null)
    } catch {
      results.push(null)
    }
  }

  return Response.json(
    { results },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
