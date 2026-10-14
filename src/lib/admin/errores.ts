import 'server-only'

/**
 * Traduce los errores de Postgres, PostgREST y Supabase Auth a mensajes en
 * español para los toasts del panel. El error original nunca llega a la
 * pantalla (puede llevar nombres de tablas o políticas): se registra en los
 * logs del servidor con su contexto.
 */

export type TipoError =
  | 'duplicado'
  | 'referencia'
  | 'permiso'
  | 'no-encontrado'
  | 'red'
  | 'esquema'
  | 'desconocido'

const MENSAJES: Record<TipoError, string> = {
  duplicado: 'Ya existe un registro con esos datos.',
  referencia:
    'Hay datos relacionados que lo impiden: puede que el registro ya no exista o que otros datos dependan de él.',
  permiso:
    'No tienes permiso para hacer esto. Vuelve a iniciar sesión con una cuenta de admin.',
  'no-encontrado':
    'No lo encontramos: puede que ya se haya borrado. Recarga la página.',
  red: 'No hubo respuesta de la base de datos. Revisa la conexión e inténtalo de nuevo en unos segundos.',
  esquema:
    'Falta aplicar una migración de la base de datos para poder hacer esto.',
  desconocido:
    'No se pudo completar la acción. Inténtalo de nuevo; si sigue fallando, revisa los logs del servidor.',
}

/** Códigos de «falta la tabla, la columna o la función» (migración). */
const ESQUEMA = new Set([
  '42P01',
  '42703',
  '42883',
  'PGRST202',
  'PGRST204',
  'PGRST205',
])

const RED_RE =
  /fetch failed|failed to fetch|network|timed? ?out|econn(refused|reset)|etimedout|enotfound|eai_again|socket hang up/i

interface ErrorConCodigo {
  code?: unknown
  message?: unknown
  status?: unknown
  name?: unknown
}

function leer(error: unknown): {
  code: string
  message: string
  status: number | null
  name: string
} {
  const e: ErrorConCodigo =
    typeof error === 'object' && error !== null ? (error as ErrorConCodigo) : {}
  return {
    code: typeof e.code === 'string' ? e.code : '',
    message:
      typeof e.message === 'string'
        ? e.message
        : typeof error === 'string'
          ? error
          : '',
    status: typeof e.status === 'number' ? e.status : null,
    name: typeof e.name === 'string' ? e.name : '',
  }
}

/** Clasifica un error de base de datos (o de red) en un tipo conocido. */
export function clasificarError(error: unknown): TipoError {
  const { code, message, status, name } = leer(error)
  if (code === '23505') return 'duplicado'
  if (code === '23503') return 'referencia'
  if (ESQUEMA.has(code)) return 'esquema'
  if (
    code === '42501' ||
    code.startsWith('PGRST3') ||
    status === 401 ||
    status === 403 ||
    /row-level security|permission denied/i.test(message)
  ) {
    return 'permiso'
  }
  if (code === 'PGRST116' || code === 'user_not_found' || status === 404) {
    return 'no-encontrado'
  }
  if (
    code === '57014' ||
    code.startsWith('08') ||
    status === 0 ||
    status === 408 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    name === 'AbortError' ||
    name === 'AuthRetryableFetchError' ||
    RED_RE.test(message)
  ) {
    return 'red'
  }
  return 'desconocido'
}

/** Registro en los logs del servidor (nunca en la respuesta). */
export function registrarErrorAdmin(contexto: string, error: unknown): void {
  const { code, message, status } = leer(error)
  const detalle = [code, status === null ? '' : String(status), message]
    .filter(Boolean)
    .join(' · ')
  // eslint-disable-next-line no-console
  console.error(`[admin] ${contexto}: ${detalle.slice(0, 500)}`)
}

/**
 * Mensaje amable para la UI. `propios` sustituye el texto de un tipo cuando
 * la acción puede decirlo mejor («Ya existe una función con esa clave»).
 */
export function mensajeError(
  error: unknown,
  contexto: string,
  propios: Partial<Record<TipoError, string>> = {}
): string {
  registrarErrorAdmin(contexto, error)
  const tipo = clasificarError(error)
  return propios[tipo] ?? MENSAJES[tipo]
}
