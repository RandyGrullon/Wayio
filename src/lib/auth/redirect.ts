import { safeRedirectPath } from '@/lib/utils/baseUrl'
import { APP_AUTH_CALLBACK, NUEVA_CLAVE_PATH } from '@/lib/auth/constants'
import type { TipoOtpEmail } from '@/lib/auth/constants'

/**
 * Validación de destinos tras autenticarse (sin dependencias de servidor).
 * Todo destino sale de aquí: nunca se redirige a un `next` sin validar.
 */

/** Rutas a las que no tiene sentido volver tras iniciar sesión. */
function esRutaDeAuth(path: string): boolean {
  const base = path.split(/[?#]/)[0] ?? path
  return (
    base === '/login' || base.startsWith('/login/') || base.startsWith('/auth/')
  )
}

/**
 * ¿Lleva caracteres de control o barras invertidas? El parser de URL descarta
 * tabuladores y saltos de línea y trata "\" como "/", así que "/\t/evil.com" o
 * "/\t\\evil.com" acabarían en "//evil.com" (open redirect). Ninguna ruta
 * interna legítima los necesita.
 */
function tieneCaracteresPeligrosos(v: string): boolean {
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i)
    if (c < 0x20 || c === 0x7f || c === 0x5c) return true
  }
  return false
}

/**
 * Ruta interna segura para volver tras autenticarse. Rechaza URLs absolutas,
 * "//host", "/\\host", rutas con caracteres de control y las páginas de
 * login/auth (salvo la de nueva contraseña); en esos casos devuelve `fallback`.
 */
export function destinoSeguro(next: unknown, fallback = '/'): string {
  if (typeof next !== 'string' || tieneCaracteresPeligrosos(next)) {
    return fallback
  }
  const path = safeRedirectPath(next, fallback)
  const base = path.split(/[?#]/)[0] ?? path
  if (base !== NUEVA_CLAVE_PATH && esRutaDeAuth(path)) return fallback
  return path
}

/** Si la ruta es /auth/confirm o /auth/callback, devuelve su `next` interno. */
function desenvolver(path: string): string {
  const base = path.split(/[?#]/)[0] ?? path
  if (base === '/auth/confirm' || base === '/auth/callback') {
    try {
      const interno = new URL(path, 'http://wayio.local').searchParams.get(
        'next'
      )
      return destinoSeguro(interno)
    } catch {
      return '/'
    }
  }
  return destinoSeguro(path)
}

/**
 * Resuelve el `next` de un enlace de email. Puede venir como ruta ("/grupo/x")
 * o como URL absoluta (las plantillas usan {{ .RedirectTo }}, que es la
 * emailRedirectTo de la petición o la Site URL). Solo se aceptan URLs
 * absolutas de los orígenes indicados; si apuntan a /auth/confirm o
 * /auth/callback, se usa su `next` interno.
 */
export function resolverDestino(
  raw: string | null,
  origenesPermitidos: readonly string[]
): string {
  if (!raw) return '/'
  const v = raw.trim()
  if (v.startsWith('/')) return desenvolver(v)
  let url: URL
  try {
    url = new URL(v)
  } catch {
    return '/'
  }
  if (!origenesPermitidos.includes(url.origin)) return '/'
  return desenvolver(`${url.pathname}${url.search}${url.hash}`)
}

/** ¿El enlace se pidió desde la app móvil (emailRedirectTo = wayio://...)? */
export function esDestinoApp(raw: string | null): boolean {
  return (
    typeof raw === 'string' && raw.trim().toLowerCase().startsWith('wayio://')
  )
}

/**
 * Deep link que abre la app con el token del correo. Siempre es nuestro
 * esquema y ruta fijos: nunca se reenvía a una URL que venga en el enlace.
 */
export function deepLinkApp(tokenHash: string, tipo: TipoOtpEmail): string {
  const qs = new URLSearchParams({ token_hash: tokenHash, type: tipo })
  return `${APP_AUTH_CALLBACK}?${qs.toString()}`
}

/** Formato plausible de token_hash (hex, o "pkce_..."); evita basura en URLs. */
export function tokenHashValido(v: string | null): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{8,256}$/.test(v)
}
