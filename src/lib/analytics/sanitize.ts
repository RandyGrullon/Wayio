/**
 * Limpieza de credenciales en URLs antes de mandar datos a PostHog o Sentry.
 *
 * Algunas páginas llevan secretos en la URL: /auth/abrir-app?token_hash=…
 * (enlace de email de Supabase, sirve para iniciar sesión), ?code=… de OAuth,
 * etc. PostHog guarda la URL de cada página vista ($current_url) y el href de
 * los enlaces pulsados, y Sentry las URLs de las navegaciones: sin esto, esos
 * tokens acabarían en servicios de terceros.
 *
 * Sin dependencias y apto para navegador, Node y Edge.
 */

export const MASCARA = '<MASKED>'

/**
 * `?token_hash=abc` → `?token_hash=<MASKED>`; también codificado dentro de
 * otro parámetro (`%3Ftoken_hash%3Dabc`). Los valores de estos tokens no
 * llevan '%', así que el valor termina en el primer separador.
 */
const PARAM_SENSIBLE =
  /((?:[?&#;]|%3F|%26|%23)(?:token_hash|token|code|access_token|refresh_token|provider_token|provider_refresh_token)(?:=|%3D))[^&#\s"'<>%]+/gi

const PROFUNDIDAD_MAX = 8

function sanearValor(valor: unknown, profundidad: number): unknown {
  if (typeof valor === 'string') {
    return valor.includes('=') || valor.includes('%3D') || valor.includes('%3d')
      ? valor.replace(PARAM_SENSIBLE, `$1${MASCARA}`)
      : valor
  }
  if (profundidad >= PROFUNDIDAD_MAX || valor === null) return valor
  if (typeof valor !== 'object') return valor
  if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i++) {
      const limpio = sanearValor(valor[i], profundidad + 1)
      if (limpio !== valor[i]) valor[i] = limpio
    }
    return valor
  }
  // Solo objetos planos (datos JSON del evento): nunca instancias internas de
  // los SDK (scopes, clientes, requests), que además no se envían.
  const proto: unknown = Object.getPrototypeOf(valor)
  if (proto !== Object.prototype && proto !== null) return valor
  const obj = valor as Record<string, unknown>
  for (const clave of Object.keys(obj)) {
    if (clave === 'sdkProcessingMetadata') continue
    const limpio = sanearValor(obj[clave], profundidad + 1)
    if (limpio !== obj[clave]) obj[clave] = limpio
  }
  return valor
}

/**
 * Enmascara (en el sitio) los tokens de cualquier URL que aparezca en un
 * evento, breadcrumb o conjunto de propiedades, y devuelve el mismo valor.
 * Nunca lanza: si no se pudo limpiar devuelve null (PostHog y Sentry
 * descartan entonces ese evento en vez de enviarlo con el token).
 */
export function sanearUrls<T>(valor: T): T | null {
  try {
    return sanearValor(valor, 0) as T
  } catch {
    return null
  }
}
