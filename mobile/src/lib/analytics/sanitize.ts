/**
 * Limpieza de credenciales en URLs antes de mandar datos a PostHog (copia de
 * src/lib/analytics/sanitize.ts de la web).
 *
 * Los enlaces de la app pueden llevar secretos (wayio://auth/callback?code=…,
 * token_hash=… de los correos de Supabase…): si alguno acabara en una
 * propiedad, se enmascara antes de salir del teléfono.
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
  // Solo objetos planos (datos JSON del evento).
  const proto: unknown = Object.getPrototypeOf(valor)
  if (proto !== Object.prototype && proto !== null) return valor
  const obj = valor as Record<string, unknown>
  for (const clave of Object.keys(obj)) {
    const limpio = sanearValor(obj[clave], profundidad + 1)
    if (limpio !== obj[clave]) obj[clave] = limpio
  }
  return valor
}

/**
 * Enmascara (en el sitio) los tokens de cualquier URL que aparezca en las
 * propiedades y devuelve el mismo valor. Nunca lanza: si no se pudo limpiar
 * devuelve null (y el evento se descarta en vez de enviarse con el token).
 */
export function sanearUrls<T>(valor: T): T | null {
  try {
    return sanearValor(valor, 0) as T
  } catch {
    return null
  }
}
