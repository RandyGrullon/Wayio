/**
 * Geometría del logo de Wayio («la w es la ruta; el punto es el destino»).
 * Copia de src/components/brand/marks.ts de la web (el móvil no comparte el
 * proyecto TS de la web). Si cambia allí, cambia aquí. Ver docs/DISENO.md §8.
 */

export const WORDMARK = {
  viewBox: '0 0 156 62',
  ancho: 156,
  alto: 62,
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

/** Longitud real de cada trazo (para animar `strokeDashoffset`). */
export const LARGOS: Record<WordmarkPath, number> = {
  w:
    Math.hypot(7, 24) +
    Math.hypot(7, 17) +
    Math.hypot(7, 17) +
    Math.hypot(7, 24),
  aBowl: 2 * Math.PI * 12,
  aStem: 24,
  yArm: Math.hypot(11, 24),
  yTail: Math.hypot(16.5, 36),
  iStem: 24,
  o: 2 * Math.PI * 12,
}

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
  /**
   * La ruta arranca en el borde exterior del aro (radio 6,25 en la dirección
   * del primer tramo): así el hueco del aro queda limpio sin usar máscara y
   * funciona sobre cualquier fondo.
   */
  route: 'M14.194 32.852 L21 51 L30 34 L39 51 L46.84 28.78',
  ring: { cx: 12, cy: 27, r: 4.5, stroke: 3.5 },
  dot: { cx: 51, cy: 17, r: 6.5 },
} as const

/** Colores de marca fijos (para fondos que son oscuros en ambos temas). */
export const BRAND = {
  tinta: '#0F1E2E',
  tintaIcono: '#142435',
  noche: '#0B1622',
  papel: '#F7F4EE',
  rosa: '#C21A66',
  rosaOscuro: '#F55A9A',
} as const

export const TAGLINE = 'Traza tu viaje · Vive el camino'
/** Coordenadas de Santo Domingo (Zona Colonial). */
export const COORDS_SDQ = '18.4861° N · 69.9312° O'
