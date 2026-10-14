/**
 * Saneado de texto que llega de clientes (web, mobile o PostgREST directo)
 * antes de guardarlo. Lo comparten las rutas de viajes, grupos y referidos.
 */

/** Quita caracteres de control (salvo tabulador y saltos de línea). */
export function quitarControl(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    if ((c < 32 && c !== 9 && c !== 10 && c !== 13) || c === 127) continue
    out += ch
  }
  return out
}

/**
 * Texto que algún componente podría interpolar como HTML (p. ej. el popup del
 * mapa, API-04): cambia < y > por ‹ y › para que nunca se pueda abrir una
 * etiqueta, y quita caracteres de control. Un itinerario no necesita < ni >.
 */
export function limpiarTexto(s: string): string {
  return quitarControl(s).replace(/</g, '‹').replace(/>/g, '›')
}

const CLAVES_PROHIBIDAS = new Set(['__proto__', 'constructor', 'prototype'])
const MAX_PROFUNDIDAD = 12
const MAX_CLAVES = 200
const MAX_ELEMENTOS = 1000
const MAX_TEXTO = 20_000

/**
 * Recorre un JSON arbitrario y lo deja seguro: textos limpios y acotados,
 * números finitos, arrays y objetos acotados y sin claves peligrosas. Se usa
 * también con los campos que no conoce el esquema (para no perderlos).
 */
export function sanearProfundo(v: unknown, profundidad = 0): unknown {
  if (profundidad > MAX_PROFUNDIDAD) return null
  if (typeof v === 'string') return limpiarTexto(v).slice(0, MAX_TEXTO)
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'boolean' || v === null) return v
  if (Array.isArray(v)) {
    return v
      .slice(0, MAX_ELEMENTOS)
      .map((x) => sanearProfundo(x, profundidad + 1))
  }
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {}
    let n = 0
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (CLAVES_PROHIBIDAS.has(k) || k.length > 100) continue
      n += 1
      if (n > MAX_CLAVES) break
      out[k] = sanearProfundo(val, profundidad + 1)
    }
    return out
  }
  return null
}
