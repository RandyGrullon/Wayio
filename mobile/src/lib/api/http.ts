/**
 * Cliente HTTP común para el backend web de Wayio (Next.js).
 *
 * - Añade `Authorization: Bearer <access_token>` con la sesión de Supabase
 *   (la app no tiene cookies; el backend acepta el token).
 * - Corta las peticiones colgadas: tiempo límite de 60 s por defecto
 *   (configurable por llamada con `timeoutMs`).
 * - Convierte las respuestas de error en `BackendError` tipados con un mensaje
 *   en español listo para mostrar al usuario.
 */
import { config } from '../../config'
import { getSupabase } from '../supabase/client'

export type BackendErrorCode =
  | 'no_config'
  | 'auth'
  | 'rate_limit'
  | 'unavailable'
  | 'bad_request'
  | 'not_found'
  | 'server'
  | 'network'
  | 'timeout'

export class BackendError extends Error {
  readonly code: BackendErrorCode
  readonly status: number
  /** Segundos a esperar antes de reintentar (solo en rate_limit). */
  readonly retryAfter: number | null
  /** Datos extra del backend (p. ej. `huecos` al reagendar). */
  readonly data: Record<string, unknown> | null
  /**
   * Código técnico del backend, si lo envió (`code`, o `error` cuando es un
   * código como 'checkout_unavailable'). Nunca se muestra al usuario.
   */
  readonly serverCode: string | null

  constructor(
    code: BackendErrorCode,
    message: string,
    status = 0,
    retryAfter: number | null = null,
    data: Record<string, unknown> | null = null,
    serverCode: string | null = null
  ) {
    super(message)
    this.name = 'BackendError'
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
    this.data = data
    this.serverCode = serverCode
  }
}

const MENSAJES: Record<BackendErrorCode, string> = {
  no_config: 'Esta función no está disponible en esta versión de la app.',
  auth: 'Tu sesión expiró. Vuelve a iniciar sesión para usar esta función.',
  rate_limit:
    'Has hecho muchas solicitudes seguidas. Espera un momento y vuelve a intentarlo.',
  unavailable:
    'Esta función no está disponible ahora mismo. Inténtalo más tarde.',
  bad_request: 'No pudimos procesar la solicitud. Revisa los datos.',
  not_found: 'No encontramos lo que buscabas.',
  server: 'Algo salió mal. Inténtalo de nuevo en unos segundos.',
  network: 'No pudimos conectar con Wayio. Revisa tu conexión.',
  timeout:
    'Wayio está tardando demasiado en responder. Revisa tu conexión e inténtalo de nuevo.',
}

/** Tiempo límite por defecto de una petición al backend. */
export const TIEMPO_LIMITE_MS = 60_000

/** Cabecera Authorization con la sesión actual (vacía si no hay sesión). */
export async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await getSupabase().auth.getSession()
    const token = data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    // Sin Supabase configurado o sin sesión: se llama sin token.
    return {}
  }
}

function codigoPorStatus(status: number): BackendErrorCode {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate_limit'
  if (status === 503) return 'unavailable'
  if (status === 404) return 'not_found'
  if (status >= 400 && status < 500) return 'bad_request'
  return 'server'
}

/** Texto no vacío o null. */
function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  /** Tiempo límite en ms (por defecto TIEMPO_LIMITE_MS = 60 s). */
  timeoutMs?: number
}

/** Llama al backend y devuelve el JSON, o lanza BackendError. */
export async function requestJSON<T>(
  path: string,
  { method = 'GET', body, timeoutMs = TIEMPO_LIMITE_MS }: RequestOptions = {}
): Promise<T> {
  if (!config.apiUrl) {
    throw new BackendError('no_config', MENSAJES.no_config)
  }

  // AbortController + setTimeout (AbortSignal.timeout no existe en Hermes).
  // El temporizador cubre también la lectura del cuerpo.
  const control = new AbortController()
  let agotado = false
  const temporizador = setTimeout(() => {
    agotado = true
    control.abort()
  }, timeoutMs)

  try {
    let res: Response
    try {
      res = await fetch(`${config.apiUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(await authHeaders()),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: control.signal,
      })
    } catch {
      if (agotado) throw new BackendError('timeout', MENSAJES.timeout)
      throw new BackendError('network', MENSAJES.network)
    }

    let data: unknown = null
    let esJson = true
    try {
      data = await res.json()
    } catch {
      data = null
      esJson = false
    }
    if (agotado) {
      throw new BackendError('timeout', MENSAJES.timeout, res.status)
    }

    if (!res.ok) {
      const code = codigoPorStatus(res.status)
      const obj =
        data && typeof data === 'object' && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : null
      // El backend responde el texto amable en `mensaje` (y entonces `error`
      // es un código técnico, p. ej. 503 { error: 'checkout_unavailable',
      // mensaje }) o directamente en `error`. Un código (sin espacios) nunca
      // se muestra al usuario.
      const mensajeServidor = texto(obj?.['mensaje'])
      const errorServidor = texto(obj?.['error'])
      const errorEsCodigo = errorServidor !== null && !/\s/.test(errorServidor)
      const mensaje =
        mensajeServidor ??
        (errorServidor && !errorEsCodigo ? errorServidor : MENSAJES[code])
      const serverCode =
        texto(obj?.['code']) ?? (errorEsCodigo ? errorServidor : null)
      const retry = Number(res.headers.get('retry-after'))
      throw new BackendError(
        code,
        mensaje,
        res.status,
        Number.isFinite(retry) && retry > 0 ? retry : null,
        obj,
        serverCode
      )
    }

    // 200 sin JSON (proxy, portal cautivo, HTML de error): nunca devolver null
    // como si fuera T, que rompería al llamante con un error técnico.
    if (!esJson || data === null) {
      throw new BackendError('server', MENSAJES.server, res.status)
    }

    return data as T
  } finally {
    clearTimeout(temporizador)
  }
}

/** Opciones por llamada (p. ej. `{ timeoutMs: 300_000 }` para la IA lenta). */
export type CallOptions = Pick<RequestOptions, 'timeoutMs'>

export function postJSON<T>(
  path: string,
  body: unknown,
  opciones: CallOptions = {}
): Promise<T> {
  return requestJSON<T>(path, { ...opciones, method: 'POST', body })
}

export function getJSON<T>(
  path: string,
  opciones: CallOptions = {}
): Promise<T> {
  return requestJSON<T>(path, opciones)
}
