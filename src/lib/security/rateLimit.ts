import 'server-only'

/**
 * Rate limit por clave (usuario o IP) con ventana deslizante.
 *
 * - Si están UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN usa Upstash
 *   (global entre instancias serverless, vía su API REST, sin dependencias).
 * - Si no, cae a un contador en memoria por instancia: suficiente en local y
 *   como freno básico, pero NO es global en producción (configura Upstash).
 */

export interface RateLimitResult {
  ok: boolean
  /** Segundos hasta poder reintentar (0 si ok). */
  retryAfter: number
  remaining: number
}

export interface RateLimitOptions {
  /** Nombre de la regla (p. ej. 'generate'). */
  bucket: string
  /** Identificador (user id o IP). */
  id: string
  limit: number
  windowSec: number
}

const memoria = new Map<string, number[]>()

function limitarEnMemoria(o: RateLimitOptions): RateLimitResult {
  const key = `${o.bucket}:${o.id}`
  const now = Date.now()
  const desde = now - o.windowSec * 1000
  const hits = (memoria.get(key) ?? []).filter((t) => t > desde)
  if (hits.length >= o.limit) {
    const masViejo = hits[0] ?? now
    memoria.set(key, hits)
    return {
      ok: false,
      retryAfter: Math.max(
        1,
        Math.ceil((masViejo + o.windowSec * 1000 - now) / 1000)
      ),
      remaining: 0,
    }
  }
  hits.push(now)
  memoria.set(key, hits)
  // Limpieza ocasional para que el mapa no crezca sin límite.
  if (memoria.size > 5000) {
    for (const [k, v] of memoria) {
      if (!v.some((t) => t > desde)) memoria.delete(k)
    }
  }
  return { ok: true, retryAfter: 0, remaining: o.limit - hits.length }
}

async function limitarEnUpstash(
  o: RateLimitOptions,
  url: string,
  token: string
): Promise<RateLimitResult> {
  // Ventana fija alineada: clave por (bucket, id, ventana) con INCR + EXPIRE.
  const ventana = Math.floor(Date.now() / (o.windowSec * 1000))
  const key = `rl:${o.bucket}:${o.id}:${ventana}`
  const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, String(o.windowSec)],
    ]),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Upstash ${res.status}`)
  const data = (await res.json()) as { result?: number }[]
  const count = Number(data[0]?.result ?? 0)
  const restante = o.limit - count
  if (restante < 0) {
    const finVentana = (ventana + 1) * o.windowSec * 1000
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((finVentana - Date.now()) / 1000)),
      remaining: 0,
    }
  }
  return { ok: true, retryAfter: 0, remaining: restante }
}

export async function rateLimit(o: RateLimitOptions): Promise<RateLimitResult> {
  const url = process.env['UPSTASH_REDIS_REST_URL']
  const token = process.env['UPSTASH_REDIS_REST_TOKEN']
  if (url && token) {
    try {
      return await limitarEnUpstash(o, url, token)
    } catch {
      // Si Upstash falla, no bloqueamos al usuario: caemos a memoria.
    }
  }
  return limitarEnMemoria(o)
}

/** IP del cliente (detrás de Vercel/proxy) para limitar a anónimos. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  return (
    fwd?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'anon'
  )
}

/** Respuesta 429 estándar en español. */
export function tooManyRequests(r: RateLimitResult): Response {
  return Response.json(
    {
      error: 'Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.',
      retryAfter: r.retryAfter,
    },
    { status: 429, headers: { 'Retry-After': String(r.retryAfter) } }
  )
}
