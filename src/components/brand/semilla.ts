/**
 * Aleatoriedad determinista para el arte generativo (postales, sellos).
 * La misma semilla da siempre el mismo dibujo en el servidor y en el cliente,
 * así no hay desajustes de hidratación ni cambios entre visitas.
 */

// Marcas diacríticas combinantes (U+0300–U+036F), construidas sin literales raros.
const DIACRITICOS = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  'g'
)

/** Minúsculas, sin tildes ni espacios sobrantes («Samaná» → «samana»). */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().trim()
}

/** Hash de 32 bits (FNV-1a) de un texto normalizado. */
export function hashTexto(texto: string): number {
  const limpio = normalizar(texto)
  let h = 0x811c9dc5
  for (let i = 0; i < limpio.length; i++) {
    h ^= limpio.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Generador mulberry32: devuelve números en [0, 1). */
export function generador(semilla: number) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Azar = ReturnType<typeof generador>

/** Utilidades sobre un generador. */
export function azar(semilla: string | number) {
  const r = generador(
    typeof semilla === 'number' ? semilla : hashTexto(semilla)
  )
  const entre = (min: number, max: number) => min + (max - min) * r()
  return {
    r,
    entre,
    entero: (min: number, max: number) => Math.floor(entre(min, max + 1)),
    elegir: <T>(lista: readonly [T, ...T[]]): T =>
      lista[Math.floor(r() * lista.length)] ?? lista[0],
  }
}

/** Redondeo corto para atributos SVG. */
export const n2 = (v: number) => Math.round(v * 100) / 100
