/**
 * Cliente HTTP común para el backend web de Wayio (Next.js).
 *
 * - Añade `Authorization: Bearer <access_token>` con la sesión de Supabase
 *   (la app no tiene cookies; el backend acepta el token).
 * - Las rutas de IA que exigen sesión (generate, adjust, analyze-video) se
 *   llaman con `requiereSesion`: sin access_token no se manda la petición
 *   (solo daría 401) y se lanza el error de sesión en el cliente.
 * - Ante un 401 refresca la sesión UNA vez y repite la petición; si vuelve a
 *   dar 401 muestra «Tu sesión expiró…» en vez del texto del servidor
 *   («Inicia sesión…» no tiene sentido en una app que siempre entra con cuenta).
 *   Si el refresco falla por la red, la sesión sigue viva y el error es
 *   'network' («No pudimos conectar con Wayio…»), no de sesión.
 * - Corta las peticiones colgadas: tiempo límite de 60 s por defecto
 *   (configurable por llamada con `timeoutMs`).
 * - Convierte las respuestas de error en `BackendError` tipados con un mensaje
 *   en español listo para mostrar al usuario.
 */
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
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

/** Texto de sesión caducada o rechazada (también lo usa lib/api/stream.ts). */
export const MENSAJE_SESION_EXPIRADA = MENSAJES.auth

/**
 * `code` del backend cuando falta la sesión (401 de `exigirSesion`,
 * src/lib/ai/routeKit.ts de la web).
 */
export const CODIGO_AUTH_REQUIRED = 'auth_required'

/** Tiempo límite por defecto de una petición al backend. */
export const TIEMPO_LIMITE_MS = 60_000

export interface LecturaToken {
  token: string | null
  /** Había sesión pero el token caducado no se pudo refrescar por la red. */
  sinRed: boolean
}

async function leerToken(): Promise<LecturaToken> {
  try {
    // getSession() ya refresca el access_token si caducó o está por caducar.
    const { data, error } = await getSupabase().auth.getSession()
    const token = data.session?.access_token ?? null
    return {
      token,
      sinRed: token === null && isAuthRetryableFetchError(error),
    }
  } catch {
    // Sin Supabase configurado o sin sesión: se llama sin token.
    return { token: null, sinRed: false }
  }
}

function cabeceraAuth(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Cabecera Authorization con la sesión actual (vacía si no hay sesión). */
export async function authHeaders(): Promise<Record<string, string>> {
  return cabeceraAuth((await leerToken()).token)
}

/** Error de sesión generado en el cliente: equivale a un 401 auth_required. */
export function errorDeSesion(): BackendError {
  return new BackendError(
    'auth',
    MENSAJES.auth,
    401,
    null,
    { code: CODIGO_AUTH_REQUIRED },
    CODIGO_AUTH_REQUIRED
  )
}

/**
 * Access token para una ruta que exige sesión. Sin token no se llama al
 * backend: lanza `errorDeSesion()` o, si el refresco falló por falta de red,
 * BackendError('network').
 */
export async function tokenObligatorio(): Promise<string> {
  const { token, sinRed } = await leerToken()
  if (token) return token
  if (sinRed) throw new BackendError('network', MENSAJES.network)
  throw errorDeSesion()
}

/**
 * Pide a Supabase un access_token nuevo tras un 401 (Supabase agrupa los
 * refrescos simultáneos en uno). `token` es null si no se pudo; si el refresh
 * token ya no vale, Supabase emite SIGNED_OUT y la app vuelve sola a
 * AuthScreen. `sinRed` indica que el refresco falló por la red (sin conexión,
 * timeout o Supabase Auth caído): Supabase conserva la sesión, así que no hay
 * que decir «Tu sesión expiró» sino que no se pudo conectar.
 */
export async function refrescarToken(): Promise<LecturaToken> {
  try {
    const { data, error } = await getSupabase().auth.refreshSession()
    if (error) return { token: null, sinRed: isAuthRetryableFetchError(error) }
    return { token: data.session?.access_token ?? null, sinRed: false }
  } catch (e) {
    return { token: null, sinRed: isAuthRetryableFetchError(e) }
  }
}

/**
 * Segundos a esperar de un 429/503: la cabecera Retry-After o, si falta (o
 * viene como fecha), el `retryAfter` del cuerpo JSON. null si no hay.
 */
export function segundosDeEspera(
  cabecera: string | null,
  cuerpo: unknown
): number | null {
  const candidatos: unknown[] = [
    cabecera === null || cabecera.trim() === '' ? null : Number(cabecera),
    cuerpo,
  ]
  for (const v of candidatos) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      return Math.ceil(v)
    }
  }
  return null
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
  /**
   * La ruta exige sesión: sin access_token no se llama y se lanza
   * BackendError('auth') (o 'network' si el token no se pudo refrescar).
   */
  requiereSesion?: boolean
}

interface Respuesta {
  status: number
  ok: boolean
  data: unknown
  esJson: boolean
  retryAfter: string | null
}

/** Un intento de petición, con su propio tiempo límite (cubre también el cuerpo). */
async function enviar(
  url: string,
  method: 'GET' | 'POST',
  body: unknown,
  timeoutMs: number,
  token: string | null
): Promise<Respuesta> {
  // AbortController + setTimeout (AbortSignal.timeout no existe en Hermes).
  const control = new AbortController()
  let agotado = false
  const temporizador = setTimeout(() => {
    agotado = true
    control.abort()
  }, timeoutMs)

  try {
    let res: Response
    try {
      res = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...cabeceraAuth(token),
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
    return {
      status: res.status,
      ok: res.ok,
      data,
      esJson,
      retryAfter: res.headers.get('retry-after'),
    }
  } finally {
    clearTimeout(temporizador)
  }
}

function errorDeRespuesta(res: Respuesta): BackendError {
  const code = codigoPorStatus(res.status)
  const obj =
    res.data && typeof res.data === 'object' && !Array.isArray(res.data)
      ? (res.data as Record<string, unknown>)
      : null
  // El backend responde el texto amable en `mensaje` (y entonces `error`
  // es un código técnico, p. ej. 503 { error: 'checkout_unavailable',
  // mensaje }) o directamente en `error`. Un código (sin espacios) nunca
  // se muestra al usuario.
  const mensajeServidor = texto(obj?.['mensaje'])
  const errorServidor = texto(obj?.['error'])
  const errorEsCodigo = errorServidor !== null && !/\s/.test(errorServidor)
  // 401 (ya tras el refresco): la app siempre entra con cuenta, así que es una
  // sesión caducada o revocada, no «Inicia sesión para usar esta función.».
  const mensaje =
    res.status === 401
      ? MENSAJES.auth
      : (mensajeServidor ??
        (errorServidor && !errorEsCodigo ? errorServidor : MENSAJES[code]))
  const serverCode =
    texto(obj?.['code']) ?? (errorEsCodigo ? errorServidor : null)
  return new BackendError(
    code,
    mensaje,
    res.status,
    segundosDeEspera(res.retryAfter, obj?.['retryAfter']),
    obj,
    serverCode
  )
}

/** Llama al backend y devuelve el JSON, o lanza BackendError. */
export async function requestJSON<T>(
  path: string,
  {
    method = 'GET',
    body,
    timeoutMs = TIEMPO_LIMITE_MS,
    requiereSesion = false,
  }: RequestOptions = {}
): Promise<T> {
  if (!config.apiUrl) {
    throw new BackendError('no_config', MENSAJES.no_config)
  }
  const url = `${config.apiUrl}${path}`
  const token = requiereSesion
    ? await tokenObligatorio()
    : (await leerToken()).token

  let res = await enviar(url, method, body, timeoutMs, token)
  // 401: el servidor no aceptó el token (caducado o revocado). Se refresca la
  // sesión UNA vez y se repite. El 401 sale antes de que la ruta haga nada,
  // así que repetir un POST no duplica ningún efecto ni gasto.
  if (res.status === 401) {
    const nuevo = await refrescarToken()
    if (nuevo.token && nuevo.token !== token) {
      res = await enviar(url, method, body, timeoutMs, nuevo.token)
    } else if (nuevo.sinRed) {
      // La sesión sigue viva (Supabase no la borra por un fallo de red): pedir
      // que vuelva a iniciar sesión no tendría salida sin cerrar sesión.
      throw new BackendError('network', MENSAJES.network)
    }
  }

  if (!res.ok) throw errorDeRespuesta(res)

  // 200 sin JSON (proxy, portal cautivo, HTML de error): nunca devolver null
  // como si fuera T, que rompería al llamante con un error técnico.
  if (!res.esJson || res.data === null) {
    throw new BackendError('server', MENSAJES.server, res.status)
  }

  return res.data as T
}

/**
 * Opciones por llamada (p. ej. `{ timeoutMs: 300_000 }` para la IA lenta o
 * `{ requiereSesion: true }` para las rutas de IA que exigen cuenta).
 */
export type CallOptions = Pick<RequestOptions, 'timeoutMs' | 'requiereSesion'>

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
