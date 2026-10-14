/**
 * Colores de los días del itinerario (docs/DISENO.md §10.2).
 *
 * 10 colores cíclicos que alternan tono; nunca el magenta (reservado al GPS).
 * - base: mapa claro y texto sobre papel (número blanco encima, ≥5,41:1).
 * - luz: mapa oscuro (número de tinta encima, ≥6,58:1).
 * El color nunca va solo: siempre con el número y «Día N».
 *
 * En CSS usa var(--dia-N) / bg-dia-N (cambia solo con el tema).
 */

export type TemaMapa = 'light' | 'dark'

/** Bases (mapa claro): Terracota, Mar, Latón, Índigo, Ciruela, Oliva, Azul Caribe, Burdeos, Pizarra, Ocre. */
export const DAY_BASE = [
  '#A63F26',
  '#1E5A57',
  '#7E5F22',
  '#3B4C8C',
  '#7A3B69',
  '#4F6427',
  '#1F6F95',
  '#8A2F3C',
  '#4A5560',
  '#9A5B13',
] as const

/** Variantes luz (mapa oscuro), en el mismo orden. */
export const DAY_LUZ = [
  '#E58A68',
  '#6FB8AE',
  '#D9B468',
  '#8E9EE0',
  '#D08BC0',
  '#A9C26B',
  '#6CB8DE',
  '#E07F8C',
  '#A9B6C2',
  '#E3A15A',
] as const

/** Nombres de los colores (leyendas, aria). */
export const DAY_NOMBRES = [
  'Terracota',
  'Mar',
  'Latón',
  'Índigo',
  'Ciruela',
  'Oliva',
  'Azul Caribe',
  'Burdeos',
  'Pizarra',
  'Ocre',
] as const

/** Color del número sobre el marcador según el tema. */
export const DAY_NUM: Record<TemaMapa, string> = {
  light: '#FFFFFF',
  dark: '#0B1622',
}

/**
 * Compatibilidad: array de colores por día (los 'base'). Lo usan TripMap y la
 * normalización del itinerario (colorMapa).
 */
export const DAY_COLORS = DAY_BASE

function indiceCiclico(indice: number): number {
  const n = DAY_BASE.length
  const i = Number.isFinite(indice) ? Math.trunc(indice) : 0
  return ((i % n) + n) % n
}

/** Color hex del día `indice` (0 = día 1) para el tema dado. */
export function dayColor(indice: number, tema: TemaMapa = 'light'): string {
  const i = indiceCiclico(indice)
  return (tema === 'dark' ? DAY_LUZ[i] : DAY_BASE[i]) ?? DAY_BASE[0]
}

/** var(--dia-N) del día `indice` (0 = día 1): cambia solo con el tema. */
export function dayColorVar(indice: number): string {
  return `var(--dia-${indiceCiclico(indice) + 1})`
}

/**
 * Clases de Tailwind por día, escritas literalmente para que Tailwind las
 * detecte (no se pueden construir con plantillas).
 */
const CLASES_DIA = [
  { bg: 'bg-dia-1', text: 'text-dia-1', border: 'border-dia-1' },
  { bg: 'bg-dia-2', text: 'text-dia-2', border: 'border-dia-2' },
  { bg: 'bg-dia-3', text: 'text-dia-3', border: 'border-dia-3' },
  { bg: 'bg-dia-4', text: 'text-dia-4', border: 'border-dia-4' },
  { bg: 'bg-dia-5', text: 'text-dia-5', border: 'border-dia-5' },
  { bg: 'bg-dia-6', text: 'text-dia-6', border: 'border-dia-6' },
  { bg: 'bg-dia-7', text: 'text-dia-7', border: 'border-dia-7' },
  { bg: 'bg-dia-8', text: 'text-dia-8', border: 'border-dia-8' },
  { bg: 'bg-dia-9', text: 'text-dia-9', border: 'border-dia-9' },
  { bg: 'bg-dia-10', text: 'text-dia-10', border: 'border-dia-10' },
] as const

export interface DiaClases {
  bg: string
  text: string
  border: string
}

/** Clases bg/text/border del día `indice` (0 = día 1). */
export function diaClases(indice: number): DiaClases {
  return CLASES_DIA[indiceCiclico(indice)] ?? CLASES_DIA[0]
}
