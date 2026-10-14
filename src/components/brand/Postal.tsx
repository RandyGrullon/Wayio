import { useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { Sello } from './Sello'
import type { SelloTono } from './Sello'
import { azar, hashTexto, n2, normalizar } from './semilla'
import './brand.css'

/**
 * Postal generativa (docs/DISENO.md §1.1, §5.4 «postal», §6).
 *
 * El arte es un SVG determinista: la misma semilla (slug o nombre del
 * destino) da siempre el mismo dibujo. Cielo, astro, horizonte y paisaje
 * salen de la semilla y de la escena (playa, montaña, ciudad, selva,
 * desierto, mar). Tiene versión de día (claro) y de noche (oscuro), que se
 * elige con html.dark sin JS.
 *
 * REGLA: el texto nunca va sobre el arte; siempre en el pie de papel.
 * El arte no usa el magenta (un solo punto magenta por vista).
 */

export type Escena =
  | 'playa'
  | 'montana'
  | 'ciudad'
  | 'selva'
  | 'desierto'
  | 'mar'
/** 4:5 y 4:3 para tarjetas; 16:9 y 3:1 para bandas (login móvil, cabeceras). */
export type Proporcion = '4:5' | '4:3' | '16:9' | '3:1'

const ALTO: Record<Proporcion, number> = {
  '4:5': 500,
  '4:3': 300,
  '16:9': 225,
  '3:1': 134,
}
const ASPECTO: Record<Proporcion, string> = {
  '4:5': 'aspect-[4/5]',
  '4:3': 'aspect-[4/3]',
  '16:9': 'aspect-video',
  '3:1': 'aspect-[3/1]',
}

type Pt = readonly [number, number]
type Capa = 'c1' | 'c2' | 'c3' | 'c4' | 'suelo' | 'espuma'
type Paleta = Record<Capa, string>

// ── Paletas (solo tonos del sistema o derivados cercanos) ──────────────────
const PAISAJES: Record<Escena, { claro: Paleta; oscuro: Paleta }> = {
  playa: {
    claro: {
      c1: '#AED8D1',
      c2: '#519F96',
      c3: '#1E5A57',
      c4: '#173E3C',
      suelo: '#E9DFCC',
      espuma: '#FFFFFF',
    },
    oscuro: {
      c1: '#22384D',
      c2: '#1E5A57',
      c3: '#173E3C',
      c4: '#0B2423',
      suelo: '#2E4760',
      espuma: '#7FBFB6',
    },
  },
  montana: {
    claro: {
      c1: '#C3CDD8',
      c2: '#8E9FB2',
      c3: '#56708A',
      c4: '#4F6427',
      suelo: '#3F5320',
      espuma: '#FFFFFF',
    },
    oscuro: {
      c1: '#2E4760',
      c2: '#22384D',
      c3: '#18293B',
      c4: '#112131',
      suelo: '#0B1622',
      espuma: '#B6C2CE',
    },
  },
  ciudad: {
    claro: {
      c1: '#DCCFB7',
      c2: '#1E5A57',
      c3: '#46525F',
      c4: '#33827A',
      suelo: '#C9C1B2',
      espuma: '#FFFFFF',
    },
    oscuro: {
      c1: '#2E4760',
      c2: '#173E3C',
      c3: '#0B1622',
      c4: '#1A4A48',
      suelo: '#18293B',
      espuma: '#7FBFB6',
    },
  },
  selva: {
    claro: {
      c1: '#CCD8AE',
      c2: '#A9C26B',
      c3: '#4F6427',
      c4: '#23582F',
      suelo: '#2E4A26',
      espuma: '#FFFFFF',
    },
    oscuro: {
      c1: '#1E3A33',
      c2: '#173029',
      c3: '#11241F',
      c4: '#0B1A16',
      suelo: '#0B1622',
      espuma: '#93D6A6',
    },
  },
  desierto: {
    claro: {
      c1: '#EBD6A6',
      c2: '#D9B468',
      c3: '#B08A3E',
      c4: '#9A5B13',
      suelo: '#9A7531',
      espuma: '#FFFFFF',
    },
    oscuro: {
      c1: '#533E1C',
      c2: '#3E2F17',
      c3: '#2E210D',
      c4: '#22180A',
      suelo: '#1A1208',
      espuma: '#E9C88A',
    },
  },
  mar: {
    claro: {
      c1: '#7FBFB6',
      c2: '#AED8D1',
      c3: '#519F96',
      c4: '#246B66',
      suelo: '#1E5A57',
      espuma: '#FFFFFF',
    },
    oscuro: {
      c1: '#2E4760',
      c2: '#18293B',
      c3: '#1A4A48',
      c4: '#173E3C',
      suelo: '#0B2423',
      espuma: '#7FBFB6',
    },
  },
}

/** Cielos: [cielo, bruma, bruma cercana al horizonte]. */
type Tono3 = readonly [string, string, string]
const CIELOS: readonly [
  { claro: Tono3; oscuro: Tono3 },
  ...Array<{ claro: Tono3; oscuro: Tono3 }>,
] = [
  {
    claro: ['#F3EBDD', '#F0E2CC', '#EBD8BC'],
    oscuro: ['#112131', '#16283A', '#1C3045'],
  }, // crema
  {
    claro: ['#E9F2EF', '#DDEBE7', '#CFE3DE'],
    oscuro: ['#0F2230', '#133038', '#183843'],
  }, // brisa
  {
    claro: ['#F7ECEA', '#F2DFDB', '#EDD2CB'],
    oscuro: ['#141E33', '#1A2640', '#212F4C'],
  }, // amanecer
  {
    claro: ['#F5EEDD', '#EFE3C6', '#E9D7AF'],
    oscuro: ['#13202B', '#192834', '#20313E'],
  }, // latón
]

const SOLES: readonly [string, ...string[]] = [
  '#D9B468',
  '#E58A68',
  '#F2C76E',
  '#E3A15A',
]
const ESCENAS: readonly [Escena, ...Escena[]] = [
  'playa',
  'montana',
  'ciudad',
  'selva',
  'mar',
]

// ── Inferencia de escena por texto ──────────────────────────────────────────
const PISTAS: Array<[Escena, RegExp]> = [
  ['mar', /crucero|cruise|velero|navega|islas griegas|mediterrane/],
  ['desierto', /desierto|duna|sahara|marrue|dubai|atacama|wadi|petra|egipto/],
  [
    'montana',
    /monta|sierra|jarabacoa|constanza|pico duarte|andes|alpes|cusco|machu|patagonia|nepal|suiza|aspen|bariloche|volcan|nieve|esqui|dolomit|pirineo/,
  ],
  [
    'selva',
    /selva|bosque|amazon|costa rica|monteverde|haitises|cascada|salto|damajagua|jungla|tayrona|chiapas/,
  ],
  [
    'playa',
    /playa|beach|punta cana|bavaro|caribe|isla|cayo|cancun|tulum|bayahibe|samana|terrenas|cabarete|sosua|miches|juan dolio|boca chica|puerto plata|aruba|curazao|bahamas|maldivas|bali|ibiza|mallorca|hawai|varadero|san andres|riviera|costa/,
  ],
  [
    'ciudad',
    /ciudad|colonial|santo domingo|santiago|madrid|paris|londres|roma|nueva york|new york|tokio|barcelona|lisboa|berlin|mexico|bogota|buenos aires|miami|cartagena|habana|praga|viena|amsterdam|estambul/,
  ],
]

/** Elige la escena a partir del nombre o slug del destino. */
export function inferirEscena(texto: string): Escena {
  const t = normalizar(texto).replace(/[-_]+/g, ' ')
  for (const [escena, re] of PISTAS) if (re.test(t)) return escena
  return ESCENAS[hashTexto(t) % ESCENAS.length] ?? 'playa'
}

// ── Geometría ───────────────────────────────────────────────────────────────
type Rand = ReturnType<typeof azar>

const p = (x: number, y: number) => `${n2(x)} ${n2(y)}`

/** Catmull-Rom → Bézier cúbica: una curva suave que pasa por los puntos. */
function suave(pts: Pt[]): string {
  const at = (i: number): Pt =>
    pts[Math.max(0, Math.min(pts.length - 1, i))] ?? [0, 0]
  let d = `M${p(at(0)[0], at(0)[1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    d += ` C${p(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)} ${p(
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6
    )} ${p(p2[0], p2[1])}`
  }
  return d
}

const cerrar = (d: string, W: number, H: number) =>
  `${d} L${p(W + 12, H + 12)} L${p(-12, H + 12)} Z`

/** Altura de una polilínea en x (interpolación lineal). */
function yEn(pts: Pt[], x: number): number {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (a && b && x >= a[0] && x <= b[0]) {
      const t = (x - a[0]) / (b[0] - a[0] || 1)
      return a[1] + (b[1] - a[1]) * t
    }
  }
  return pts[pts.length - 1]?.[1] ?? 0
}

/** Banda de olas (o de arena) que llega hasta abajo. */
function ola(a: Rand, W: number, base: number, amp: number, onda: number) {
  const fase = a.entre(0, Math.PI * 2)
  const pasos = Math.max(6, Math.round((W + 24) / (onda / 3)))
  const pts: Pt[] = []
  for (let i = 0; i <= pasos; i++) {
    const x = -12 + ((W + 24) * i) / pasos
    pts.push([x, base + amp * Math.sin((x / onda) * Math.PI * 2 + fase)])
  }
  return { d: suave(pts), pts }
}

/** Colinas suaves (selva, dunas, montes cercanos). */
function colinas(a: Rand, W: number, base: number, amp: number, n: number) {
  const pts: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const x = -16 + ((W + 32) * i) / n + (i > 0 && i < n ? a.entre(-10, 10) : 0)
    const alto = i % 2 === 1 ? a.entre(0.55, 1) : a.entre(0, 0.3)
    pts.push([x, base - amp * alto])
  }
  return { d: suave(pts), pts }
}

/** Cordillera de picos rectos. */
function cresta(a: Rand, W: number, base: number, alto: number, picos: number) {
  const pts: Pt[] = [[-12, base - alto * a.entre(0.05, 0.3)]]
  const n = picos * 2
  for (let i = 1; i < n; i++) {
    const x = -12 + ((W + 24) * i) / n + a.entre(-9, 9)
    const y =
      i % 2 === 1
        ? base - alto * a.entre(0.6, 1)
        : base - alto * a.entre(0.08, 0.38)
    pts.push([x, y])
  }
  pts.push([W + 12, base - alto * a.entre(0.1, 0.4)])
  return { d: `M${pts.map(([x, y]) => p(x, y)).join(' L')}`, pts }
}

/** Siluetas de edificios (con cúpulas y campanarios coloniales). */
function skyline(
  a: Rand,
  W: number,
  base: number,
  hMin: number,
  hMax: number,
  coloniales: boolean
) {
  let d = ''
  const ventanas: Array<{ x: number; y: number }> = []
  let x = -10
  while (x < W + 10) {
    const w = a.entre(18, 42)
    const h = a.entre(hMin, hMax)
    const top = base - h
    const r = a.r()
    if (coloniales && r < 0.14) {
      // Cúpula con linterna
      d += ` M${p(x, base)} V${n2(top)} H${n2(x + w)} V${n2(base)} Z`
      d += ` M${p(x + 2, top)} A${n2(w / 2 - 2)} ${n2((w / 2 - 2) * 0.92)} 0 0 1 ${p(x + w - 2, top)} Z`
      d += ` M${p(x + w / 2 - 1.5, top - (w / 2 - 2) * 0.92 + 1)} h3 v-6 h-3 Z`
    } else if (coloniales && r < 0.26) {
      // Campanario: torre estrecha con remate en arco
      const tw = Math.min(w, 20)
      const th = h * 1.35
      d += ` M${p(x, base)} V${n2(base - th)} Q${p(x + tw / 2, base - th - tw * 0.7)} ${p(x + tw, base - th)} V${n2(base)} Z`
      if (w > tw + 6)
        d += ` M${p(x + tw, base)} V${n2(top + h * 0.35)} H${n2(x + w)} V${n2(base)} Z`
    } else {
      d += ` M${p(x, base)} V${n2(top)} H${n2(x + w)} V${n2(base)} Z`
    }
    // Ventanas (solo se ven de noche)
    for (let vy = top + 8; vy < base - 6; vy += 10) {
      for (let vx = x + 5; vx < x + w - 6; vx += 8) {
        if (a.r() < 0.28) ventanas.push({ x: vx, y: vy })
      }
    }
    x += w + a.entre(-3, 2)
  }
  return { d, ventanas }
}

/** Palmera monolínea (tronco curvo y seis hojas que se arquean y caen). */
function palmera(a: Rand, bx: number, by: number, alto: number, lado: 1 | -1) {
  const tx = bx + lado * alto * a.entre(0.16, 0.3)
  const ty = by - alto
  const trazos = [
    `M${p(bx, by)} Q${p(bx + lado * alto * 0.02, by - alto * 0.6)} ${p(tx, ty)}`,
  ]
  const angulos = [168, 132, 96, 58, 22, -12]
  for (const g of angulos) {
    const rad = (g * Math.PI) / 180
    const L = alto * a.entre(0.34, 0.48)
    const dx = Math.cos(rad)
    const dy = -Math.sin(rad)
    trazos.push(
      `M${p(tx, ty)} Q${p(tx + dx * L * 0.55, ty + dy * L * 0.55 - L * 0.2)} ${p(tx + dx * L, ty + dy * L + L * 0.32)}`
    )
  }
  return trazos
}

/** Pino monolínea. */
function pino(x: number, y: number, h: number) {
  return `M${p(x, y)} V${n2(y - h)} M${p(x - h * 0.3, y - h * 0.32)} L${p(x, y - h * 0.68)} L${p(x + h * 0.3, y - h * 0.32)} M${p(x - h * 0.22, y - h * 0.62)} L${p(x, y - h)} L${p(x + h * 0.22, y - h * 0.62)}`
}

// ── Arte ────────────────────────────────────────────────────────────────────
interface Dibujo {
  capas: Array<{ d: string; capa: Capa | 'linea'; trazo?: number }>
  ventanas: Array<{ x: number; y: number }>
  /** Rango vertical (fracción del terreno) donde puede caer el destino. */
  destino: readonly [number, number]
}

function paisaje(
  escena: Escena,
  a: Rand,
  W: number,
  H: number,
  yh: number
): Dibujo {
  const L = H - yh
  const capas: Dibujo['capas'] = []
  let ventanas: Dibujo['ventanas'] = []
  let destino: readonly [number, number] = [0.35, 0.6]

  switch (escena) {
    case 'playa': {
      capas.push({
        d: cerrar(ola(a, W, yh + L * 0.02, 1.4, 130).d, W, H),
        capa: 'c1',
      })
      capas.push({
        d: cerrar(ola(a, W, yh + L * 0.16, 3, 95).d, W, H),
        capa: 'c2',
      })
      capas.push({
        d: cerrar(ola(a, W, yh + L * 0.31, 4, 75).d, W, H),
        capa: 'c3',
      })
      const arena = ola(a, W, yh + L * 0.56, 6, 170)
      capas.push({ d: cerrar(arena.d, W, H), capa: 'suelo' })
      capas.push({ d: arena.d, capa: 'espuma', trazo: 2.2 })
      if (a.r() < 0.65) {
        const izq = a.r() < 0.5
        const bx = izq ? W * a.entre(0.08, 0.16) : W * a.entre(0.84, 0.92)
        const by = yEn(arena.pts, bx) + L * 0.22
        for (const d of palmera(a, bx, by, L * 1.05, izq ? 1 : -1))
          capas.push({ d, capa: 'linea', trazo: 3 })
      }
      destino = [0.62, 0.82]
      break
    }
    case 'montana': {
      const lejos = cresta(a, W, yh + L * 0.04, yh * 0.46, a.entero(3, 4))
      capas.push({ d: cerrar(lejos.d, W, H), capa: 'c1' })
      const medio = cresta(a, W, yh + L * 0.22, yh * 0.3, a.entero(4, 5))
      capas.push({ d: cerrar(medio.d, W, H), capa: 'c2' })
      const cerca = colinas(a, W, yh + L * 0.55, L * 0.32, 4)
      capas.push({ d: cerrar(cerca.d, W, H), capa: 'c3' })
      capas.push({
        d: cerrar(ola(a, W, yh + L * 0.8, 3, 180).d, W, H),
        capa: 'suelo',
      })
      const n = a.entero(3, 5)
      for (let i = 0; i < n; i++) {
        const x = W * a.entre(0.06, 0.94)
        const y = yEn(cerca.pts, x) + L * a.entre(0.08, 0.16)
        capas.push({
          d: pino(x, y, L * a.entre(0.18, 0.26)),
          capa: 'linea',
          trazo: 2.4,
        })
      }
      destino = [0.84, 0.92]
      break
    }
    case 'ciudad': {
      const lejos = skyline(
        a,
        W,
        yh + L * 0.1,
        L * 0.14,
        L * 0.3 + yh * 0.08,
        true
      )
      capas.push({ d: lejos.d, capa: 'c1' })
      const cerca = skyline(a, W, yh + L * 0.42, L * 0.12, L * 0.34, true)
      capas.push({ d: cerca.d, capa: 'c3' })
      ventanas = cerca.ventanas
      capas.push({
        d: `M-12 ${n2(yh + L * 0.42)} H${n2(W + 12)} V${n2(H + 12)} H-12 Z`,
        capa: 'suelo',
      })
      // Malecón: el mar al pie de la ciudad
      const mar = ola(a, W, yh + L * 0.56, 2.5, 90)
      capas.push({ d: cerrar(mar.d, W, H), capa: 'c4' })
      capas.push({ d: mar.d, capa: 'espuma', trazo: 1.8 })
      capas.push({
        d: cerrar(ola(a, W, yh + L * 0.78, 3.5, 70).d, W, H),
        capa: 'c2',
      })
      destino = [0.47, 0.5]
      break
    }
    case 'selva': {
      capas.push({
        d: cerrar(colinas(a, W, yh + L * 0.06, yh * 0.3, 5).d, W, H),
        capa: 'c1',
      })
      capas.push({
        d: cerrar(colinas(a, W, yh + L * 0.34, L * 0.3, 5).d, W, H),
        capa: 'c2',
      })
      const cerca = colinas(a, W, yh + L * 0.66, L * 0.24, 4)
      capas.push({ d: cerrar(cerca.d, W, H), capa: 'c3' })
      capas.push({
        d: cerrar(ola(a, W, yh + L * 0.9, 2.5, 160).d, W, H),
        capa: 'suelo',
      })
      if (a.r() < 0.5) {
        const izq = a.r() < 0.5
        const bx = izq ? W * 0.12 : W * 0.88
        for (const d of palmera(a, bx, H + 4, L * 0.92, izq ? 1 : -1))
          capas.push({ d, capa: 'linea', trazo: 3 })
      }
      destino = [0.7, 0.86]
      break
    }
    case 'desierto': {
      capas.push({
        d: cerrar(colinas(a, W, yh + L * 0.06, L * 0.2, 3).d, W, H),
        capa: 'c1',
      })
      const media = colinas(a, W, yh + L * 0.4, L * 0.24, 4)
      capas.push({ d: cerrar(media.d, W, H), capa: 'c2' })
      capas.push({ d: media.d, capa: 'espuma', trazo: 1.4 })
      capas.push({
        d: cerrar(colinas(a, W, yh + L * 0.74, L * 0.22, 3).d, W, H),
        capa: 'c3',
      })
      destino = [0.55, 0.7]
      break
    }
    case 'mar': {
      capas.push({
        d: `M-12 ${n2(yh)} H${n2(W + 12)} V${n2(H + 12)} H-12 Z`,
        capa: 'c2',
      })
      const islas = a.entero(1, 2)
      for (let i = 0; i < islas; i++) {
        const x0 = W * a.entre(0.05, 0.6)
        const w = W * a.entre(0.18, 0.36)
        const h = yh * a.entre(0.06, 0.13)
        capas.push({
          d: `M${p(x0, yh + 0.5)} Q${p(x0 + w * a.entre(0.35, 0.6), yh - h * 2)} ${p(x0 + w, yh + 0.5)} Z`,
          capa: 'c1',
        })
      }
      capas.push({
        d: cerrar(ola(a, W, yh + L * 0.34, 3, 90).d, W, H),
        capa: 'c3',
      })
      capas.push({
        d: cerrar(ola(a, W, yh + L * 0.66, 4.5, 70).d, W, H),
        capa: 'c4',
      })
      destino = [0.4, 0.6]
      break
    }
  }
  return { capas, ventanas, destino }
}

export interface PostalArteProps {
  /** Semilla: slug o nombre del destino («santo-domingo», «Cartagena»). */
  semilla: string
  /** Escena; si se omite se infiere de la semilla. */
  escena?: Escena
  /** Proporción del arte. */
  proporcion?: Proporcion
  /** Ruta punteada con el aro de destino (lenguaje de marca). */
  ruta?: boolean
  className?: string | undefined
  /** Si el arte aporta información, su texto alternativo. Por defecto decorativo. */
  alt?: string
}

/**
 * Solo el arte (SVG). Úsalo para bandas o fondos recortados (login, SEO):
 * escala con `preserveAspectRatio="xMidYMid slice"`.
 */
export function PostalArte({
  semilla,
  escena,
  proporcion = '4:5',
  ruta = true,
  className,
  alt,
}: PostalArteProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const e = escena ?? inferirEscena(semilla)
  const a = azar(`${semilla}|${e}`)
  const W = 400
  const H = ALTO[proporcion]

  // Cielo, astro y horizonte
  const cielo = a.elegir(CIELOS)
  const sol = a.elegir(SOLES)
  const yh = H * a.entre(0.5, 0.6)
  const rs = Math.min(W * a.entre(0.1, 0.15), yh * 0.42)
  const sx = W * a.entre(0.24, 0.76)
  const sy = Math.max(rs + 18, yh - rs * a.entre(0.35, 1.7))
  const pal = PAISAJES[e]

  const vars: Record<`--p${'l' | 'd'}-${string}`, string> = {
    '--pl-cielo': cielo.claro[0],
    '--pl-bruma': cielo.claro[1],
    '--pl-bruma2': cielo.claro[2],
    '--pl-astro': sol,
    '--pl-reticula': '#C9C1B2',
    '--pl-linea': '#142435',
    '--pl-ruta': '#2C4258',
    '--pl-detalle': 'transparent',
    '--pd-cielo': cielo.oscuro[0],
    '--pd-bruma': cielo.oscuro[1],
    '--pd-bruma2': cielo.oscuro[2],
    '--pd-astro': '#F1EEE8',
    '--pd-reticula': '#2E4760',
    '--pd-linea': '#9AAABB',
    '--pd-ruta': '#B6C2CE',
    '--pd-detalle': '#E9C88A',
  }
  for (const capa of Object.keys(pal.claro) as Capa[]) {
    vars[`--pl-${capa}`] = pal.claro[capa]
    vars[`--pd-${capa}`] = pal.oscuro[capa]
  }

  const { capas, ventanas, destino } = paisaje(e, a, W, H, yh)

  // Retícula del cielo: meridianos curvos y paralelos, como en una carta.
  const meridianos = [0.18, 0.4, 0.62, 0.84].map((f) => {
    const x = W * f + a.entre(-10, 10)
    const curva = (f - 0.5) * 34
    return `M${p(x, -4)} Q${p(x + curva, yh / 2)} ${p(x, yh + 4)}`
  })
  const paralelos = [0.3, 0.62].map((f) => {
    const y = yh * f
    return `M-4 ${n2(y)} Q${p(W / 2, y - 10)} ${p(W + 4, y)}`
  })

  // Estrellas: solo se ven de noche (detalle transparente de día).
  const estrellas = Array.from({ length: 16 }, () => ({
    cx: n2(a.entre(8, W - 8)),
    cy: n2(a.entre(8, yh * 0.8)),
    r: n2(a.entre(0.7, 1.6)),
  })).filter((s) => Math.hypot(s.cx - sx, s.cy - sy) > rs + 14)

  // Ruta punteada hacia un aro (destino); termina en el borde del aro.
  const rutaD = (() => {
    if (!ruta) return null
    const L = H - yh
    const dx = W * a.entre(0.56, 0.8)
    const dy = yh + L * a.entre(destino[0], destino[1])
    const ox = -8
    const oy = H * 0.98
    const cx = W * a.entre(0.18, 0.34)
    const cy = Math.min(H - 8, dy + L * a.entre(0.05, 0.25))
    const tx = dx - cx
    const ty = dy - cy
    const lt = Math.hypot(tx, ty) || 1
    const ex = dx - (tx / lt) * 9
    const ey = dy - (ty / lt) * 9
    return { d: `M${p(ox, oy)} Q${p(cx, cy)} ${p(ex, ey)}`, ax: dx, ay: dy }
  })()

  const fill = (c: Capa | 'linea') =>
    ({ fill: `var(--p-${c})` }) as CSSProperties
  const a11y = alt
    ? ({ role: 'img', 'aria-label': alt } as const)
    : ({ 'aria-hidden': true } as const)
  const clipId = `wy-pc-${uid}`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
      className={cn(
        'wy-postal-arte block h-auto w-full',
        ASPECTO[proporcion],
        className
      )}
      style={vars as CSSProperties}
      {...a11y}
    >
      <defs>
        <clipPath id={clipId}>
          <rect width={W} height={n2(yh)} />
        </clipPath>
      </defs>

      {/* Cielo en bandas planas (serigrafía, sin degradados) */}
      <rect width={W} height={H} style={fill('c1')} />
      <rect width={W} height={n2(yh + 1)} style={{ fill: 'var(--p-cielo)' }} />
      <rect
        y={n2(yh * 0.58)}
        width={W}
        height={n2(yh * 0.42 + 1)}
        style={{ fill: 'var(--p-bruma)' }}
      />
      <rect
        y={n2(yh * 0.84)}
        width={W}
        height={n2(yh * 0.16 + 1)}
        style={{ fill: 'var(--p-bruma2)' }}
      />

      <g clipPath={`url(#${clipId})`}>
        <g
          fill="none"
          strokeWidth="1"
          opacity="0.7"
          style={{ stroke: 'var(--p-reticula)' }}
        >
          {meridianos.concat(paralelos).map((d) => (
            <path key={d} d={d} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
        {estrellas.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            style={{ fill: 'var(--p-detalle)' }}
          />
        ))}
        {/* Astro: sol de día, luna llena de noche, con un halo impreso */}
        <circle
          cx={n2(sx)}
          cy={n2(sy)}
          r={n2(rs + 9)}
          fill="none"
          strokeWidth="1.5"
          opacity="0.45"
          style={{ stroke: 'var(--p-astro)' }}
        />
        <circle
          cx={n2(sx)}
          cy={n2(sy)}
          r={n2(rs)}
          style={{ fill: 'var(--p-astro)' }}
        />
      </g>

      {/* Paisaje (de atrás hacia delante) */}
      {capas.map((c, i) =>
        c.trazo ? (
          <path
            key={i}
            d={c.d}
            fill="none"
            strokeWidth={c.trazo}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={c.capa === 'espuma' ? 0.75 : 1}
            style={{ stroke: `var(--p-${c.capa})` }}
          />
        ) : (
          <path key={i} d={c.d} style={fill(c.capa)} />
        )
      )}
      {ventanas.map((v, i) => (
        <rect
          key={`v${i}`}
          x={n2(v.x)}
          y={n2(v.y)}
          width="3"
          height="4"
          style={{ fill: 'var(--p-detalle)' }}
        />
      ))}

      {/* La línea y el punto: una ruta punteada que llega a un aro */}
      {rutaD ? (
        <g
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: 'var(--p-ruta)' }}
        >
          <path
            d={rutaD.d}
            strokeWidth="2.6"
            strokeDasharray="0.1 7"
            opacity="0.8"
          />
          <circle
            cx={n2(rutaD.ax)}
            cy={n2(rutaD.ay)}
            r="5.5"
            strokeWidth="2.6"
          />
        </g>
      ) : null}
    </svg>
  )
}

export interface PostalProps extends PostalArteProps {
  /** Overline del pie («DÍA 02 · SANTO DOMINGO»). */
  kicker?: ReactNode
  /** Clases extra del kicker (p. ej. `text-dia-2`). */
  kickerClassName?: string
  /** Título del pie, en Newsreader (`text-h3`). */
  titulo?: ReactNode
  /** Etiqueta del título; por defecto h3. */
  tituloComo?: 'h2' | 'h3' | 'h4' | 'p'
  /** Clases extra del título (p. ej. `text-[22px]`). */
  tituloClassName?: string
  /** Contenido extra del pie (filas, caption). */
  children?: ReactNode
  /** Sello circular que sobresale de la esquina: true = de marca, o su texto. */
  sello?: boolean | string
  selloTono?: SelloTono
  /** Radio de la tarjeta: 'card' (16) o 'sheet' (24, hero). */
  redondeo?: 'card' | 'sheet'
  /** Clases del arte (p. ej. `max-h-[360px]` en móvil: recorta sin deformar). */
  arteClassName?: string
  /** Elemento contenedor. */
  como?: 'article' | 'div' | 'figure' | 'li'
}

const hay = (v: ReactNode) => v !== undefined && v !== null && v !== false

/**
 * Tarjeta postal: arte arriba y pie de papel con kicker, título y contenido.
 * Server Component (sin JS en el cliente).
 */
export function Postal({
  kicker,
  kickerClassName,
  titulo,
  tituloComo = 'h3',
  tituloClassName,
  children,
  sello,
  selloTono = 'rosa',
  redondeo = 'card',
  className,
  arteClassName,
  como = 'article',
  ...arte
}: PostalProps) {
  const Contenedor = como
  const Titulo = tituloComo
  const hayKicker = hay(kicker)
  const hayTitulo = hay(titulo)
  const hayContenido = hay(children)
  return (
    <Contenedor className={cn('relative', className)}>
      <div
        className={cn(
          'overflow-hidden border border-border bg-surface shadow-card',
          redondeo === 'sheet' ? 'rounded-sheet' : 'rounded-card'
        )}
      >
        <PostalArte {...arte} className={arteClassName} />
        {hayKicker || hayTitulo || hayContenido ? (
          <div className="p-5">
            {hayKicker ? (
              <p className={cn('kicker', kickerClassName)}>{kicker}</p>
            ) : null}
            {hayTitulo ? (
              <Titulo
                className={cn(
                  'font-display text-h3 text-fg',
                  hayKicker && 'mt-1.5',
                  tituloClassName
                )}
              >
                {titulo}
              </Titulo>
            ) : null}
            {hayContenido ? (
              <div className="mt-3 text-body-s text-fg-muted">{children}</div>
            ) : null}
          </div>
        ) : null}
      </div>
      {sello ? (
        <Sello
          tono={selloTono}
          rotacion={-8}
          {...(typeof sello === 'string' && { texto: sello })}
          className="pointer-events-none absolute -right-2 -top-4 size-[96px] sm:-right-4 sm:-top-6 sm:size-[112px]"
        />
      ) : null}
    </Contenedor>
  )
}
