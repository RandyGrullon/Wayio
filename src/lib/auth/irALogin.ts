import { destinoSeguro } from '@/lib/auth/redirect'
import { isSupabaseConfigured } from '@/lib/supabase/config'

/**
 * Ir a /login y volver (cliente web). Único sitio que arma la URL de login:
 * /login acepta `?redirect=` y lo valida en el servidor con destinoSeguro, así
 * que aquí también se valida para no generar enlaces que luego se descartan.
 *
 * Las rutas de IA que gastan (trazar, ajustar, analizar videos y fotos)
 * exigen sesión: el servidor responde 401 {code: 'auth_required'}. En
 * desarrollo y sin Supabase no hay forma de iniciar sesión y el servidor las
 * deja usar (modoLocalSinCuentas de src/lib/ai/routeKit.ts): este módulo
 * espeja esa regla para no mandar a un login que no existe.
 *
 * Módulo sin dependencias de servidor: se puede importar desde componentes
 * cliente y desde páginas de servidor.
 */

/**
 * Espejo en el cliente de modoLocalSinCuentas (src/lib/ai/routeKit.ts): en
 * desarrollo y sin Supabase la IA se usa sin cuenta. En producción nunca
 * aplica (NODE_ENV se inyecta en el bundle).
 */
export function modoLocalSinCuentas(): boolean {
  return !isSupabaseConfigured() && process.env.NODE_ENV !== 'production'
}

/** ¿Hace falta una cuenta para usar la IA (trazar, ajustar, analizar)? */
export function iaExigeSesion(): boolean {
  return !modoLocalSinCuentas()
}

/**
 * ¿Se puede iniciar sesión en esta instalación? Sin Supabase no hay login:
 * en producción, en vez de mandar a /login, se avisa de que no está disponible.
 */
export function hayLogin(): boolean {
  return isSupabaseConfigured()
}

/**
 * URL de /login que vuelve a `redirect` tras iniciar sesión (ruta interna con
 * su query, p. ej. '/planificar?paso=datos'). Si no es segura o es la portada,
 * devuelve '/login' a secas. Nunca metas datos del formulario en `redirect`.
 */
export function urlLogin(redirect?: string | null): string {
  const destino = destinoSeguro(redirect ?? '/', '/')
  return destino === '/'
    ? '/login'
    : `/login?redirect=${encodeURIComponent(destino)}`
}

/**
 * ¿La respuesta pide iniciar sesión? 401 o `code: 'auth_required'`.
 * `cuerpo` puede ser el JSON de la respuesta o directamente el `code`.
 */
export function esAuthRequired(
  status: number | null | undefined,
  cuerpo?: unknown
): boolean {
  if (status === 401) return true
  const code =
    typeof cuerpo === 'string'
      ? cuerpo
      : typeof cuerpo === 'object' && cuerpo !== null
        ? (cuerpo as { code?: unknown }).code
        : null
  return code === 'auth_required'
}

/**
 * ¿Hay sesión guardada en este navegador? Lectura local (sin red) para
 * comprobar antes de mandar algo caro, como una foto. Devuelve null si no se
 * puede saber (sin Supabase o error): en ese caso decide el servidor.
 */
export async function haySesionLocal(): Promise<boolean | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const { data } = await createClient().auth.getSession()
    return data.session !== null
  } catch {
    return null
  }
}
