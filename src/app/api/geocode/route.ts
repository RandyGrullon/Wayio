import { z } from 'zod'
import { geoapifyConfigurado } from '@/lib/api/geoapify'
import { geocode, type GeoPoint } from '@/lib/api/geocode'
import {
  clientIp,
  rateLimit,
  type RateLimitResult,
} from '@/lib/security/rateLimit'

/**
 * POST /api/geocode  { items: [{ nombre, ciudad? }] }  (máx. 10 por petición)
 *  → { results: ({ lat, lng } | null)[] }   (mismo orden que `items`)
 *
 * Geocodificación en lote para el cliente: la pantalla de resultado la usa
 * para completar las coordenadas de las actividades que el servidor no
 * verificó. El proveedor lo elige lib/api/geocode.ts: Geoapify si hay
 * GEOAPIFY_API_KEY (con su limitador de peticiones por segundo y caché
 * persistente) y, si no, Nominatim, que admite como máximo 1 petición/segundo
 * por aplicación (cola + candado global). Aquí se limita cuánto puede pedir
 * cada IP para que nadie lo use como proxy: peticiones por ventana y, con
 * Geoapify, también créditos (lugares + ciudades distintas). El gasto total
 * diario lo acota GEOAPIFY_CREDITOS_DIA en lib/api/geoapify.ts.
 *
 * Cada lugar se busca con nivel 'lugar': nunca vale como pin el centro de su
 * ciudad o del país, haya ancla o no.
 */

export const maxDuration = 60

/** Lugares por petición (≈ 1,1 s cada uno en Nominatim). */
const MAX_ITEMS = 10
/** Peticiones por IP y ventana. */
const LIMITE = { limit: 30, windowSec: 10 * 60 }
/** Créditos de Geoapify por IP y ventana (≈ 1 por lugar y por ciudad). */
const CREDITOS_POR_IP = { limit: 200, windowSec: 10 * 60 }
/** Búsquedas simultáneas con Geoapify (su limitador regula el ritmo). */
const A_LA_VEZ_GEOAPIFY = 4
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

function demasiadas(limite: RateLimitResult): Response {
  return Response.json(
    {
      error: 'Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.',
      retryAfter: limite.retryAfter,
    },
    { status: 429, headers: { 'Retry-After': String(limite.retryAfter) } }
  )
}

/** `fn` sobre cada elemento, como mucho `n` a la vez y en el mismo orden. */
async function enParalelo<T, R>(
  items: readonly T[],
  n: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const salida = new Array<R>(items.length)
  let siguiente = 0
  const trabajador = async (): Promise<void> => {
    while (siguiente < items.length) {
      const i = siguiente++
      salida[i] = await fn(items[i] as T)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, trabajador)
  )
  return salida
}

export async function POST(request: Request): Promise<Response> {
  const id = `ip:${clientIp(request)}`
  const limite = await rateLimit({ bucket: 'geocode', id, ...LIMITE })
  if (!limite.ok) return demasiadas(limite)

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

  const items = parsed.data.items
  const geoapify = geoapifyConfigurado()
  if (geoapify) {
    // Con Geoapify cada búsqueda cuesta un crédito (las de caché no, pero el
    // texto libre casi nunca acierta en ella): se cuenta lo que puede gastar.
    const ciudades = new Set(
      items.flatMap((it) =>
        it.nombre && it.ciudad ? [it.ciudad.toLowerCase()] : []
      )
    )
    const creditos = items.filter((it) => it.nombre).length + ciudades.size
    if (creditos > 0) {
      const r = await rateLimit({
        bucket: 'geocode-creditos',
        id,
        ...CREDITOS_POR_IP,
        coste: creditos,
      })
      if (!r.ok) return demasiadas(r)
    }
  }

  // Ancla por ciudad (cacheada en geocode.ts): restringe la búsqueda de cada
  // lugar a su entorno para no poner pines en otro país.
  const anclas = new Map<string, Promise<GeoPoint | null>>()
  const anclaDe = (ciudad: string): Promise<GeoPoint | null> => {
    const clave = ciudad.toLowerCase()
    let ancla = anclas.get(clave)
    if (!ancla) {
      ancla = geocode(ciudad)
      anclas.set(clave, ancla)
    }
    return ancla
  }

  // Con Nominatim, uno a uno como siempre (su cola serializa igualmente).
  const results = await enParalelo(
    items,
    geoapify ? A_LA_VEZ_GEOAPIFY : 1,
    async ({
      nombre,
      ciudad,
    }): Promise<{ lat: number; lng: number } | null> => {
      if (!nombre) return null
      try {
        const ancla = ciudad ? await anclaDe(ciudad) : null
        const punto = ancla
          ? await geocode(`${nombre}, ${ciudad}`, {
              near: { lat: ancla.lat, lng: ancla.lng },
              radiusKm: RADIO_KM,
              nivel: 'lugar',
            })
          : await geocode(ciudad ? `${nombre}, ${ciudad}` : nombre, {
              nivel: 'lugar',
            })
        return punto ? { lat: punto.lat, lng: punto.lng } : null
      } catch {
        return null
      }
    }
  )

  return Response.json(
    { results },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
