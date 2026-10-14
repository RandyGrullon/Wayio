/**
 * Tokens de movimiento para framer-motion (docs/DISENO.md §7.1).
 * Las duraciones van en segundos (framer-motion) y replican --dur-* de CSS.
 */

/** Curvas cubic-bezier como tuplas para `transition.ease`. */
export const EASE = {
  /** Entradas. */
  papel: [0.22, 1, 0.36, 1],
  /** Salidas (≈30 % más cortas). */
  salida: [0.4, 0, 1, 1],
  /** Trazos SVG y desplazamientos A→B. */
  tinta: [0.65, 0, 0.35, 1],
  /** Aterrizajes y sellos. */
  sello: [0.34, 1.56, 0.64, 1],
  /** Revelados de pantalla. */
  portal: [0.76, 0, 0.24, 1],
} as const

/** Duraciones en segundos. */
export const DUR = {
  instant: 0.08,
  fast: 0.14,
  base: 0.2,
  medium: 0.28,
  slow: 0.42,
  page: 0.52,
} as const

/** Springs: suave (layout, FLIP), firme (thumb, tabs, switch), sello. */
export const SPRING = {
  suave: { type: 'spring', stiffness: 260, damping: 30 },
  firme: { type: 'spring', stiffness: 500, damping: 38 },
  sello: { type: 'spring', stiffness: 600, damping: 18 },
} as const
