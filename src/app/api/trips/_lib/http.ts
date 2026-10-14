import 'server-only'
import type {
  PostgrestError,
  SupabaseClient,
  User,
} from '@supabase/supabase-js'
import { getRequestAuth } from '@/lib/supabase/request'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { limpiarTexto } from './texto'

/**
 * Utilidades HTTP comunes de las rutas de datos (viajes, grupos, referidos,
 * dispositivos, Stripe). Los mensajes de `error` son SIEMPRE aptos para
 * mostrarse al usuario; `code` es para que la UI decida qué hacer.
 */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function esUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

export const NO_STORE = { 'Cache-Control': 'private, no-store' } as const

/** Respuesta JSON de éxito sin caché (datos del usuario). */
export function okJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE })
}

/** Respuesta JSON de error con mensaje amable y código estable. */
export function errorJson(
  status: number,
  mensaje: string,
  code: string,
  extra: Record<string, unknown> = {}
): Response {
  return Response.json(
    { error: mensaje, code, ...extra },
    { status, headers: NO_STORE }
  )
}

/** Registro de errores de servidor (va a los logs de la plataforma). */
export function registrarError(contexto: string, detalle: unknown): void {
  const info =
    detalle instanceof Error
      ? detalle.message
      : typeof detalle === 'object' && detalle !== null
        ? JSON.stringify(detalle)
        : String(detalle)
  // eslint-disable-next-line no-console
  console.error(`[wayio] ${contexto}: ${info.slice(0, 500)}`)
}

export type Autenticacion =
  | { ok: true; supabase: SupabaseClient; user: User }
  | { ok: false; response: Response }

/**
 * Exige sesión: cookies (web) o `Authorization: Bearer` (mobile). El cliente
 * devuelto actúa como el usuario, así que RLS decide qué puede ver o tocar.
 */
export async function autenticar(request: Request): Promise<Autenticacion> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      response: errorJson(
        503,
        'Las cuentas todavía no están disponibles. Vuelve a intentarlo más tarde.',
        'auth_unavailable'
      ),
    }
  }
  const { supabase, user } = await getRequestAuth(request)
  if (!supabase || !user) {
    return {
      ok: false,
      response: errorJson(401, 'Inicia sesión para continuar.', 'unauthorized'),
    }
  }
  return { ok: true, supabase, user }
}

export type LecturaJson =
  | { ok: true; body: unknown }
  | { ok: false; response: Response }

/** Lee el body como JSON con tope de tamaño. Nunca lanza: devuelve 400/413. */
export async function leerJson(
  request: Request,
  maxBytes = 64_000
): Promise<LecturaJson> {
  const declarado = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declarado) && declarado > maxBytes) {
    return {
      ok: false,
      response: errorJson(
        413,
        'Los datos enviados son demasiado grandes.',
        'too_large'
      ),
    }
  }
  let texto: string
  try {
    texto = await request.text()
  } catch {
    return {
      ok: false,
      response: errorJson(
        400,
        'No pudimos leer los datos enviados.',
        'invalid_body'
      ),
    }
  }
  if (texto.length > maxBytes) {
    return {
      ok: false,
      response: errorJson(
        413,
        'Los datos enviados son demasiado grandes.',
        'too_large'
      ),
    }
  }
  if (!texto.trim()) {
    return {
      ok: false,
      response: errorJson(
        400,
        'Faltan los datos de la petición.',
        'invalid_body'
      ),
    }
  }
  try {
    return { ok: true, body: JSON.parse(texto) as unknown }
  } catch {
    return {
      ok: false,
      response: errorJson(
        400,
        'El formato de los datos no es válido.',
        'invalid_json'
      ),
    }
  }
}

/** Lee una propiedad de un body desconocido sin asumir que es un objeto. */
export function campo(body: unknown, clave: string): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return undefined
  }
  return (body as Record<string, unknown>)[clave]
}

type ErrorLike = Pick<PostgrestError, 'code' | 'message'> | null | undefined

/** ¿El error indica que falta la migración (tabla, columna o función)? */
export function esFaltaDeEsquema(error: ErrorLike): boolean {
  const code = error?.code ?? ''
  return [
    '42P01',
    '42703',
    '42883',
    'PGRST202',
    'PGRST204',
    'PGRST205',
  ].includes(code)
}

/** Traduce un error de base de datos a una respuesta amable (y lo registra). */
export function errorDb(error: ErrorLike, contexto: string): Response {
  registrarError(contexto, { code: error?.code, message: error?.message })
  if (error?.code === '42501') {
    return errorJson(403, 'No tienes permiso para hacer esto.', 'forbidden')
  }
  if (esFaltaDeEsquema(error)) {
    return errorJson(
      503,
      'Esta función todavía no está disponible. Inténtalo más tarde.',
      'feature_unavailable'
    )
  }
  return errorJson(
    500,
    'No pudimos completar la acción. Inténtalo de nuevo en unos segundos.',
    'db_error'
  )
}

/** Nombre que verán los demás miembros del grupo (nunca el email completo). */
export function nombreVisible(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const candidato =
    (typeof meta?.['full_name'] === 'string' && meta['full_name']) ||
    (typeof meta?.['name'] === 'string' && meta['name']) ||
    (user.email ? user.email.split('@')[0] : '') ||
    'Viajero'
  const limpio = limpiarTexto(String(candidato)).trim().slice(0, 80)
  return limpio || 'Viajero'
}
