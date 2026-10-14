/**
 * Línea de tiempo de la intro «La ruta llega» (docs/DISENO.md §9.5–§9.6).
 * Todas las cifras son milisegundos desde el primer paint. Coordenadas en el
 * viewBox del wordmark (0 0 156 62).
 *
 * Es la única fuente de tiempos: keyframes.ts genera el CSS a partir de aquí
 * e IntroHandoff lee `t.handoff`, `t.coords` y `t.reveal`.
 */
import { W_VERTICES, WORDMARK } from '../marks'
import type { WordmarkPath } from '../marks'

export type Punto = readonly [number, number]

/** Curvas (idénticas a los tokens de §2.1, en literal para no depender de @theme). */
export const CURVAS = {
  papel: 'cubic-bezier(0.22, 1, 0.36, 1)',
  salida: 'cubic-bezier(0.4, 0, 1, 1)',
  tinta: 'cubic-bezier(0.65, 0, 0.35, 1)',
  sello: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  portal: 'cubic-bezier(0.76, 0, 0.24, 1)',
  o: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const

export const INTRO = {
  W: W_VERTICES,
  FLIGHT: {
    from: [32.5, 20] as Punto,
    ctrl: [73.75, -30] as Punto,
    to: [WORDMARK.dot.cx, WORDMARK.dot.cy] as Punto,
  },
  t: {
    wStart: 160,
    wEnd: 840,
    flyEnd: 1260,
    /** Fin del reloj CSS: empieza el relevo (FLIP + portal). */
    handoff: 2100,
    /** Las coordenadas suben aquí; el scramble dura `scramble` ms. */
    coords: 1640,
    scramble: 300,
    /** Inicio del revelado del hero (.wy-hero-item). */
    reveal: 2250,
    /** Fallback sin hidratación: fundido del overlay y aparición del logo real. */
    fallbackOut: 2150,
    fallbackLogo: 2450,
    /**
     * Fin del revelado CSS del hero sin hidratación (wy-hero-in de intro.css:
     * 2250 + 4 × 60 de stagger + 520 ms). Si se hidrata tarde, «done» espera
     * a esto para no cortar la subida de los bloques a medio camino.
     */
    fallbackFin: 3020,
    /** Tope duro (lo aplica el bootScript del <head>). */
    tope: 3200,
  },
  segEase: [0.45, 0, 0.55, 1],
  flyEase: [0.65, 0, 0.35, 1],
  samples: 24,
  trail: 6,
  /** Radio de los puntos de la estela. */
  trailR: 1.4,
} as const

/** Animación de un trazo con `wy-draw` (dashoffset 100 → 0). */
export interface Trazo {
  path: WordmarkPath
  delay: number
  dur: number
  ease: string
}

/** Trazos que no son la w (la w y el punto los genera keyframes.ts). */
export const TRAZOS: readonly Trazo[] = [
  { path: 'aBowl', delay: 900, dur: 160, ease: CURVAS.papel },
  { path: 'yArm', delay: 980, dur: 80, ease: CURVAS.papel },
  { path: 'aStem', delay: 1020, dur: 80, ease: CURVAS.papel },
  { path: 'yTail', delay: 1040, dur: 140, ease: CURVAS.papel },
  // El impacto del aterrizaje «planta» el asta de la i, de arriba abajo.
  { path: 'iStem', delay: 1260, dur: 160, ease: CURVAS.papel },
  { path: 'o', delay: 1340, dur: 280, ease: CURVAS.o },
]

/** Aros: ping de origen y dos ondas GPS al aterrizar. */
export const AROS = [
  {
    id: 'ping',
    centro: W_VERTICES[0] as Punto,
    trazo: 1.5,
    anim: 'wy-ring-a',
    delay: 0,
    dur: 520,
  },
  {
    id: 'onda1',
    centro: [WORDMARK.dot.cx, WORDMARK.dot.cy] as Punto,
    trazo: 1.5,
    anim: 'wy-ring-b',
    delay: 1280,
    dur: 600,
  },
  {
    id: 'onda2',
    centro: [WORDMARK.dot.cx, WORDMARK.dot.cy] as Punto,
    trazo: 1,
    anim: 'wy-ring-c',
    delay: 1420,
    dur: 540,
  },
] as const

/** Elementos HTML del overlay (retícula, fantasma, punto, tagline, hint). */
export const DECOR = {
  reticula: { delay: 0, dur: 260 },
  fantasma: { delay: 60, dur: 840 },
  pop: { delay: 0, dur: 160 },
  squash: { delay: 1260, dur: 240 },
  tagline: { delay: 1560, dur: 340 },
  coords: { delay: 1640, dur: 340 },
  hint: { delay: 600, dur: 300 },
  estela: { dur: 460 },
} as const
