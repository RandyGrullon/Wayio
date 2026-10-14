/**
 * Geometría del logo de Wayio («la w es la ruta; el punto es el destino»).
 * Fuente única para la web, la intro, las imágenes OG/iconos y la app móvil.
 * Ver docs/DISENO.md §8.
 *
 * OJO: scripts/brand/generar-iconos.mjs lee los objetos WORDMARK, ISOTIPO,
 * FAVICON y BRAND de este archivo (los evalúa como literales). Mantén cada
 * uno como un literal de objeto plano terminado en `} as const`.
 */

export const WORDMARK = {
  viewBox: '0 0 156 62',
  stroke: 7, // x-height 24 (y 20→44), base y=44, descendente y=56
  paths: {
    w: 'M4.5 20 L11.5 44 L18.5 27 L25.5 44 L32.5 20',
    aBowl: 'M68.5 32 A12 12 0 1 0 44.5 32 A12 12 0 1 0 68.5 32', // empieza en el asta, antihorario
    aStem: 'M68.5 20 V44',
    yArm: 'M80 20 L91 44',
    yTail: 'M102 20 L85.5 56',
    iStem: 'M115 20 V44',
    o: 'M139 20 A12 12 0 1 0 139 44 A12 12 0 1 0 139 20', // desde las 12, antihorario
  },
  dot: { cx: 115, cy: 8, r: 5.25 }, // diámetro 1,5 × trazo; 3,25 sobre el remate de la i
} as const

export type WordmarkPath = keyof typeof WORDMARK.paths

/** Vértices de la w (origen → destino). */
export const W_VERTICES = [
  [4.5, 20],
  [11.5, 44],
  [18.5, 27],
  [25.5, 44],
  [32.5, 20],
] as const

export const ISOTIPO = {
  viewBox: '0 0 64 64',
  stroke: 6,
  route: 'M12 27 L21 51 L30 34 L39 51 L46.84 28.78',
  ring: { cx: 12, cy: 27, r: 4.5, stroke: 3.5, hole: 2.75 },
  dot: { cx: 51, cy: 17, r: 6.5 }, // en la prolongación del último tramo (12,−34); hueco de 3
} as const

/** Caja visual del isotipo (para centrarlo en iconos y sellos). */
export const ISOTIPO_CAJA = { x0: 5.75, y0: 10.5, x1: 57.5, y1: 54 } as const

/**
 * Favicon en rejilla de 32 (§8.3). Sin aro: no se lee a 16 px.
 * `chico` es la variante de 16 px (trazo y punto más gruesos).
 */
export const FAVICON = {
  viewBox: '0 0 32 32',
  rx: 7,
  route: 'M5.6 12.4 L10.2 24.2 L14.8 16.2 L19.4 24.2 L23 14',
  stroke: 3.4,
  dot: { cx: 25.4, cy: 7.4, r: 3.7 },
  chico: { stroke: 3.8, r: 4 },
} as const

/** Colores de marca fijos (para iconos e imágenes generadas fuera del CSS). */
export const BRAND = {
  tinta: '#0F1E2E',
  tintaIcono: '#142435',
  noche: '#0B1622',
  papel: '#F7F4EE',
  rosa: '#C21A66',
  rosaOscuro: '#F55A9A',
  rosaTexto: '#A11254',
  laton: '#9A7531',
  latonTexto: '#7E5F22',
  regla: '#C9C1B2',
  filete: '#E2DCD0',
  fgMuted: '#46525F',
  fgSubtle: '#56626F',
} as const

export const WORDMARK_PATHS = Object.values(WORDMARK.paths)

/** Textos de marca reutilizables. */
export const TAGLINE = 'Traza tu viaje · Vive el camino'
export const SELLO_TEXTO = 'WAYIO · TRAZA TU VIAJE · VIVE EL CAMINO ·'
/** Coordenadas de Santo Domingo (Zona Colonial). */
export const COORDS_SDQ = '18.4861° N · 69.9312° O'
