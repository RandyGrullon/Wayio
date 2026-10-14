/**
 * Línea de tiempo de la intro móvil «La ruta llega» (docs/DISENO.md §9.9):
 * guion comprimido de ~1,9 s. Todo son funciones puras del tiempo (ms) en
 * coordenadas del viewBox del wordmark (0 0 156 62); IntroSplash las muestrea
 * cada 10 ms y las convierte en interpolaciones de Animated, así el punto y la
 * punta de cada trazo van exactamente sincronizados.
 *
 * | ms        | Acción                                                     |
 * |-----------|------------------------------------------------------------|
 * | 0–160     | El punto del splash se desliza del centro al inicio de la w |
 * | 160–700   | Se traza la w con el punto en la punta (frena en vértices)  |
 * | 700–980   | Vuelo en arco con estela; «a» y «y» se trazan (720–940)     |
 * | 980       | Háptico ligero, squash, ondas GPS y asta de la i (980–1100) |
 * | 1040–1240 | «o»                                                        |
 * | 1200–1500 | Tagline y coordenadas de Santo Domingo                      |
 * | 1520–1880 | Relevo: el logo vuela a la cabecera y el papel se funde     |
 */
import { LARGOS, W_VERTICES, WORDMARK, type WordmarkPath } from './marks'

export type Punto = readonly [number, number]

/** Curva cúbica de Bézier (CSS) como función x → y. */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): (x: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const X = (t: number): number => ((ax * t + bx) * t + cx) * t
  const Y = (t: number): number => ((ay * t + by) * t + cy) * t
  const dX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx
  return (x: number): number => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x
      if (Math.abs(e) < 1e-6) return Y(t)
      const d = dX(t)
      if (Math.abs(d) < 1e-6) break
      t -= e / d
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 40 && Math.abs(X(t) - x) > 1e-6; i++) {
      if (X(t) < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return Y(t)
  }
}

const lineal = (x: number): number => x

export const CURVA = {
  papel: cubicBezier(0.22, 1, 0.36, 1),
  salida: cubicBezier(0.4, 0, 1, 1),
  tramo: cubicBezier(0.45, 0, 0.55, 1),
  vuelo: cubicBezier(0.65, 0, 0.35, 1),
  o: cubicBezier(0.16, 1, 0.3, 1),
} as const

/** Hitos (ms desde el primer fotograma). */
export const T = {
  deslizar: 160,
  wFin: 700,
  vueloFin: 980,
  aterrizaje: 980,
  squashFin: 1160,
  decorFuera: 1520,
  decorFueraFin: 1680,
  relevo: 1520,
  relevoDuracion: 360,
  fin: 1900,
  tope: 3200,
} as const

/** El punto del splash nativo está en el centro de la pantalla = centro del wordmark. */
export const CENTRO: Punto = [WORDMARK.ancho / 2, WORDMARK.alto / 2]

const P1: Punto = W_VERTICES[0]
const VUELO = {
  desde: W_VERTICES[W_VERTICES.length - 1] ?? P1,
  control: [73.75, -30] as Punto,
  hasta: [WORDMARK.dot.cx, WORDMARK.dot.cy] as Punto,
}

function tramo(
  t: number,
  a: number,
  b: number,
  ease: (x: number) => number = lineal
): number {
  if (t <= a) return 0
  if (t >= b) return 1
  return ease((t - a) / (b - a))
}

const lerp = (a: number, b: number, u: number): number => a + (b - a) * u

function quad(u: number): [number, number] {
  const { desde: a, control: c, hasta: b } = VUELO
  const v = 1 - u
  return [
    v * v * a[0] + 2 * u * v * c[0] + u * u * b[0],
    v * v * a[1] + 2 * u * v * c[1] + u * u * b[1],
  ]
}

// ── La w: tramos con tiempos proporcionales a su longitud ──────────────────

const SEGMENTOS = W_VERTICES.slice(1).map((b, i) => {
  const a = W_VERTICES[i] ?? P1
  return { a, b, largo: Math.hypot(b[0] - a[0], b[1] - a[1]) }
})
const LARGO_W = SEGMENTOS.reduce((s, x) => s + x.largo, 0)

const TIEMPOS_W = (() => {
  let acc = 0
  return SEGMENTOS.map((s) => {
    const t0 = T.deslizar + (acc / LARGO_W) * (T.wFin - T.deslizar)
    acc += s.largo
    const t1 = T.deslizar + (acc / LARGO_W) * (T.wFin - T.deslizar)
    return { t0, t1 }
  })
})()

/** Posición en la w y distancia recorrida; el punto frena en cada vértice. */
function enLaW(t: number): { x: number; y: number; dist: number } {
  if (t <= T.deslizar) return { x: P1[0], y: P1[1], dist: 0 }
  let acc = 0
  for (let i = 0; i < SEGMENTOS.length; i++) {
    const s = SEGMENTOS[i]
    const tt = TIEMPOS_W[i]
    if (!s || !tt) break
    if (t <= tt.t1) {
      const u = tramo(t, tt.t0, tt.t1, CURVA.tramo)
      return {
        x: lerp(s.a[0], s.b[0], u),
        y: lerp(s.a[1], s.b[1], u),
        dist: acc + s.largo * u,
      }
    }
    acc += s.largo
  }
  return { x: VUELO.desde[0], y: VUELO.desde[1], dist: LARGO_W }
}

// ── Estela del vuelo (6 puntos en t = k/7) ─────────────────────────────────

function inversa(y: number): number {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2
    if (CURVA.vuelo(m) < y) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

export const ESTELA = Array.from({ length: 6 }, (_, k) => {
  const u = (k + 1) / 7
  const [cx, cy] = quad(u)
  return {
    cx,
    cy,
    aparece: T.wFin + inversa(u) * (T.vueloFin - T.wFin),
  }
})

export const RADIO_ESTELA = 1.4

// ── El punto ──────────────────────────────────────────────────────────────

const SQUASH: readonly (readonly [number, number, number])[] = [
  [0, 1, 1],
  [0.3, 1.22, 0.78],
  [0.62, 0.94, 1.06],
  [1, 1, 1],
]

function squash(t: number): [number, number] {
  if (t <= T.aterrizaje || t >= T.squashFin) return [1, 1]
  const k = (t - T.aterrizaje) / (T.squashFin - T.aterrizaje)
  for (let i = 1; i < SQUASH.length; i++) {
    const a = SQUASH[i - 1]
    const b = SQUASH[i]
    if (a && b && k <= b[0]) {
      const u = (k - a[0]) / (b[0] - a[0])
      return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]
    }
  }
  return [1, 1]
}

/**
 * Elipse del punto en el instante t. `r0` es el radio inicial (el del punto
 * del splash nativo, en unidades del viewBox). El squash se apoya en la base
 * del punto, como si aterrizara.
 */
export function punto(
  t: number,
  r0: number
): { cx: number; cy: number; rx: number; ry: number } {
  const R: number = WORDMARK.dot.r
  let x: number
  let y: number
  let r = R
  if (t < T.deslizar) {
    const u = tramo(t, 0, T.deslizar, CURVA.papel)
    x = lerp(CENTRO[0], P1[0], u)
    y = lerp(CENTRO[1], P1[1], u)
    r = lerp(r0, R, u)
  } else if (t < T.wFin) {
    const p = enLaW(t)
    x = p.x
    y = p.y
  } else if (t < T.vueloFin) {
    const u = CURVA.vuelo(tramo(t, T.wFin, T.vueloFin))
    ;[x, y] = quad(u)
    r = R * (1 - 0.1 * Math.sin(Math.PI * u))
  } else {
    x = VUELO.hasta[0]
    y = VUELO.hasta[1]
  }
  const [sx, sy] = squash(t)
  const rx = r * sx
  const ry = r * sy
  return { cx: x, cy: y + r - ry, rx, ry }
}

// ── Trazos ────────────────────────────────────────────────────────────────

type Trazo = Exclude<WordmarkPath, 'w'>

const TIEMPO_TRAZO: Record<
  Trazo,
  { a: number; b: number; ease: (x: number) => number }
> = {
  aBowl: { a: 720, b: 850, ease: CURVA.papel },
  yArm: { a: 780, b: 850, ease: CURVA.papel },
  aStem: { a: 810, b: 880, ease: CURVA.papel },
  yTail: { a: 830, b: 940, ease: CURVA.papel },
  // El impacto del aterrizaje «planta» el asta de la i, de arriba abajo.
  iStem: { a: 980, b: 1100, ease: CURVA.papel },
  o: { a: 1040, b: 1240, ease: CURVA.o },
}

/** Fracción dibujada (0..1) de un trazo en t. La w sigue al punto. */
export function dibujado(path: WordmarkPath, t: number): number {
  if (path === 'w') return enLaW(t).dist / LARGO_W
  const { a, b, ease } = TIEMPO_TRAZO[path]
  return tramo(t, a, b, ease)
}

/** strokeDashoffset para dibujar desde el inicio del trazo. */
export function dashoffset(path: WordmarkPath, t: number): number {
  return LARGOS[path] * (1 - dibujado(path, t))
}

/** Opacidad del trazo: 0 hasta que empieza (evita puntos fantasma). */
export function trazoVisible(path: WordmarkPath, t: number): number {
  return dibujado(path, t) > 0.002 ? 1 : 0
}

// ── Decoración ────────────────────────────────────────────────────────────

/** Factor de salida común de la decoración en el relevo (1 → 0). */
function fueraDecor(t: number): number {
  return 1 - tramo(t, T.decorFuera, T.decorFueraFin, CURVA.salida)
}

/** W fantasma punteada: «el plan antes del viaje». */
export function fantasma(t: number): number {
  if (t < 40) return 0
  if (t < 140) return 0.9 * tramo(t, 40, 140)
  if (t < 520) return 0.9
  return 0.9 * (1 - tramo(t, 520, 660))
}

/** Aro que se expande y se apaga (ping de origen y ondas GPS). */
export function aro(
  t: number,
  a: number,
  b: number,
  escalaMax: number,
  opacidad: number
): { r: number; opacity: number } {
  if (t < a || t > b) return { r: WORDMARK.dot.r, opacity: 0 }
  const u = tramo(t, a, b, CURVA.papel)
  return {
    r: WORDMARK.dot.r * lerp(1, escalaMax, u),
    opacity: opacidad * (1 - u),
  }
}

export const AROS = {
  ping: { centro: P1, a: 100, b: 560, escala: 2.6, opacidad: 0.45, trazo: 1.5 },
  onda1: {
    centro: VUELO.hasta,
    a: 1000,
    b: 1580,
    escala: 3.4,
    opacidad: 0.55,
    trazo: 1.5,
  },
  onda2: {
    centro: VUELO.hasta,
    a: 1120,
    b: 1640,
    escala: 2.4,
    opacidad: 0.35,
    trazo: 1,
  },
} as const

export function estela(t: number, aparece: number): number {
  if (t < aparece) return 0
  return 0.6 * (1 - tramo(t, aparece, aparece + 380))
}

/** Entrada con subida de 8 px y salida en el relevo. */
export function subir(
  t: number,
  a: number,
  b: number
): { opacity: number; y: number } {
  const u = tramo(t, a, b, CURVA.papel)
  return { opacity: u * fueraDecor(t), y: 8 * (1 - u) }
}

export function reticula(t: number): { opacity: number; escala: number } {
  const u = tramo(t, 0, 260, CURVA.papel)
  return { opacity: 0.55 * u * fueraDecor(t), escala: lerp(1.03, 1, u) }
}

export function pista(t: number): number {
  return tramo(t, 450, 750) * fueraDecor(t)
}

// ── Muestreo ──────────────────────────────────────────────────────────────

const PASO = 10

/** Instantes de muestreo (0, 10, … , fin). */
export const TIEMPOS: number[] = Array.from(
  { length: Math.floor(T.fin / PASO) + 1 },
  (_, i) => i * PASO
)

/** Valores de una función del tiempo en cada instante de TIEMPOS. */
export function muestrear(fn: (t: number) => number): number[] {
  return TIEMPOS.map((t) => +fn(t).toFixed(3))
}
