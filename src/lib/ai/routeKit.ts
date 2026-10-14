import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { AiErrorCode } from '@/lib/ai/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getRequestAuth } from '@/lib/supabase/request'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/security/rateLimit'

/**
 * Utilidades comunes de las rutas de IA secundarias (ajuste, alertas,
 * reagendado, validación y video): lectura del body con tope de tamaño,
 * identificación del usuario (cookies de la web o Bearer del móvil), rate
 * limit y respuestas de error en español sin detalles técnicos.
 */

export function jsonError(
  status: number,
  error: string,
  extra: Record<string, unknown> = {},
  headers?: Record<string, string>
): Response {
  return Response.json(
    { error, ...extra },
    { status, ...(headers ? { headers } : {}) }
  )
}

export type LecturaJson =
  | { ok: true; data: unknown }
  | { ok: false; response: Response }

/**
 * Lee y parsea el JSON del body cortando en `maxBytes` (aunque no venga
 * Content-Length), para que nadie pueda mandar megas de texto a la IA.
 */
export async function leerJson(
  request: Request,
  maxBytes: number
): Promise<LecturaJson> {
  const demasiado = (): LecturaJson => ({
    ok: false,
    response: jsonError(413, 'La solicitud es demasiado grande.', {
      code: 'body_too_large',
    }),
  })
  const invalido = (): LecturaJson => ({
    ok: false,
    response: jsonError(400, 'No pudimos leer la solicitud.', {
      code: 'bad_request',
    }),
  })

  const declarado = Number(request.headers.get('content-length') ?? '')
  if (Number.isFinite(declarado) && declarado > maxBytes) return demasiado()
  if (!request.body) return invalido()

  const reader = request.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return demasiado()
      }
      partes.push(value)
    }
  } catch {
    return invalido()
  }

  try {
    const texto = Buffer.concat(partes).toString('utf8')
    return { ok: true, data: JSON.parse(texto) as unknown }
  } catch {
    return invalido()
  }
}

export interface Llamante {
  user: User | null
  supabase: SupabaseClient | null
  /** Clave del rate limit: el usuario si hay sesión, si no la IP. */
  clave: string
}

/** Identifica a quien llama (sesión por cookies o Bearer del móvil). */
export async function identificar(request: Request): Promise<Llamante> {
  let user: User | null = null
  let supabase: SupabaseClient | null = null
  try {
    const auth = await getRequestAuth(request)
    user = auth.user
    supabase = auth.supabase
  } catch {
    // Sin sesión válida: se trata como anónimo.
  }
  return {
    user,
    supabase,
    clave: user ? `u:${user.id}` : `ip:${clientIp(request)}`,
  }
}

/**
 * En desarrollo y sin Supabase no existe forma de iniciar sesión: las rutas
 * que exigen sesión se dejan usar (con el rate limit por IP) para poder probar.
 * En producción nunca aplica.
 */
export function modoLocalSinCuentas(): boolean {
  return !isSupabaseConfigured() && process.env.NODE_ENV !== 'production'
}

export type ResultadoSesion =
  | { ok: true; llamante: Llamante }
  | { ok: false; response: Response }

/** Exige sesión (cookie o Bearer). Responde 401 en español si no la hay. */
export async function exigirSesion(request: Request): Promise<ResultadoSesion> {
  const llamante = await identificar(request)
  if (llamante.user || modoLocalSinCuentas()) return { ok: true, llamante }
  return {
    ok: false,
    response: jsonError(401, 'Inicia sesión para usar esta función.', {
      code: 'auth_required',
    }),
  }
}

/**
 * Aplica el rate limit. Devuelve la respuesta 429 si se superó, o null si
 * puede seguir.
 */
export async function limitar(
  llamante: Llamante,
  bucket: string,
  limites: { conSesion: number; anonimo: number },
  ventanaSeg = 3600
): Promise<Response | null> {
  const r = await rateLimit({
    bucket,
    id: llamante.clave,
    limit: llamante.user ? limites.conSesion : limites.anonimo,
    windowSec: ventanaSeg,
  })
  return r.ok ? null : tooManyRequests(r)
}

/** Igual que `limitar` pero solo dice si se puede seguir (sin respuesta). */
export async function dentroDelLimite(
  llamante: Llamante,
  bucket: string,
  limites: { conSesion: number; anonimo: number },
  ventanaSeg = 3600
): Promise<boolean> {
  return (await limitar(llamante, bucket, limites, ventanaSeg)) === null
}

/** Status HTTP adecuado para un error de IA ya clasificado. */
export function estadoPorErrorIA(code: AiErrorCode): number {
  switch (code) {
    case 'rate_limit':
    case 'auth':
    case 'model':
      return 503
    case 'refusal':
      return 422
    case 'timeout':
      return 504
    default:
      return 502
  }
}

/**
 * Parsea la salida JSON de la IA. Con structured outputs ya es JSON; aun así
 * toleramos fences o texto alrededor (Groq en JSON mode, modelos antiguos).
 */
export function parsearJsonIA(texto: string): unknown {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  try {
    return JSON.parse(limpio) as unknown
  } catch {
    const ini = limpio.search(/[[{]/)
    const fin = Math.max(limpio.lastIndexOf('}'), limpio.lastIndexOf(']'))
    if (ini >= 0 && fin > ini) {
      return JSON.parse(limpio.slice(ini, fin + 1)) as unknown
    }
    throw new Error('La IA no devolvió JSON')
  }
}

/**
 * Limpia texto del usuario antes de meterlo en un prompt: sin caracteres de
 * control ni signos < > (para que no pueda cerrar las etiquetas que delimitan
 * los datos) y con longitud máxima.
 */
export function textoSeguro(v: string, max: number): string {
  return v
    .replace(/\p{Cc}/gu, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max)
}

export const esObjeto = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v)
