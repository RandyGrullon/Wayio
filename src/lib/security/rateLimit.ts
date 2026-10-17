import 'server-only'

/**
 * Rate limit por clave (usuario o IP) con ventana deslizante.
 *
 * - Si están UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN usa Upstash
 *   (global entre instancias serverless, vía su API REST, sin dependencias).
 * - Si no, cae a un contador en memoria por instancia: suficiente en local y
 *   como freno básico, pero NO es global en producción (configura Upstash).
 *
 * Ojo con las ventanas: en Upstash son FIJAS y alineadas a epoch, así que una
 * de 86 400 s (límites diarios) se reinicia a las 00:00 UTC (las 8:00 p. m.
 * de RD), no a medianoche de RD. En memoria la ventana es deslizante.
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
  /**
   * Unidades que gasta esta llamada (por defecto 1). Sirve para limitar por
   * créditos de un proveedor en vez de por petición.
   */
  coste?: number
}

const memoria = new Map<string, number[]>()

/** Unidades de una llamada: entero ≥ 1. */
const costeDe = (o: RateLimitOptions): number =>
  Math.max(1, Math.ceil(o.coste ?? 1))

function limitarEnMemoria(o: RateLimitOptions): RateLimitResult {
  const key = `${o.bucket}:${o.id}`
  const now = Date.now()
  const desde = now - o.windowSec * 1000
  const coste = costeDe(o)
  const hits = (memoria.get(key) ?? []).filter((t) => t > desde)
  if (hits.length + coste > o.limit) {
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
  for (let k = 0; k < coste; k++) hits.push(now)
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
  const coste = costeDe(o)
  const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      coste === 1 ? ['INCR', key] : ['INCRBY', key, String(coste)],
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

/**
 * ¿Se aplican los límites de las rutas de IA? Siempre en producción; en
 * desarrollo solo con RATE_LIMIT_ENFORCE=true (para poder correr la batería
 * de evaluación sin topes).
 */
export function limitesActivos(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env['RATE_LIMIT_ENFORCE'] === 'true'
  )
}

const plural = (n: number, uno: string, varios: string) =>
  `${n} ${n === 1 ? uno : varios}`

/**
 * Espera legible en minutos u horas («15 minutos», «1 hora y 20 minutos»,
 * «unas 6 horas»). Redondea hacia arriba: nunca promete menos de lo real.
 */
export function describirEspera(segundos: number): string {
  const minutos = Math.max(1, Math.ceil(segundos / 60))
  if (minutos < 60) return plural(minutos, 'minuto', 'minutos')
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  if (resto === 0) return plural(horas, 'hora', 'horas')
  if (horas < 3) {
    return `${plural(horas, 'hora', 'horas')} y ${plural(resto, 'minuto', 'minutos')}`
  }
  return `unas ${horas + 1} horas`
}

/**
 * Respuesta 429 estándar en español: {error, retryAfter, code:'rate_limit'}
 * más la cabecera Retry-After. El mensaje dice cuánto esperar de verdad.
 */
export function tooManyRequests(r: RateLimitResult): Response {
  return Response.json(
    {
      error: `Has hecho muchas solicitudes seguidas. Vuelve a intentarlo en ${describirEspera(r.retryAfter)}.`,
      retryAfter: r.retryAfter,
      code: 'rate_limit',
    },
    { status: 429, headers: { 'Retry-After': String(r.retryAfter) } }
  )
}
