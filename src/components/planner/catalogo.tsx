import type { ReactNode } from 'react'
import {
  Heart,
  Landmark,
  Mountain,
  Ship,
  Sun,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import type { Paquete, TipoViaje } from './borrador'

/**
 * Catálogos de la UI del planificador (docs/DISENO.md §6.2 y §6.4): estilos
 * con su icono, frases de la descripción y metadatos de cada nivel.
 */

export const TIPOS: readonly {
  value: TipoViaje
  label: string
  icon: ReactNode
}[] = [
  { value: 'aventura', label: 'Aventura', icon: <Mountain /> },
  { value: 'relax', label: 'Relax', icon: <Sun /> },
  { value: 'cultura', label: 'Cultura', icon: <Landmark /> },
  { value: 'familia', label: 'Familia', icon: <Users /> },
  { value: 'crucero', label: 'Crucero', icon: <Ship /> },
  { value: 'romantico', label: 'Romántico', icon: <Heart /> },
  { value: 'gastronomia', label: 'Gastronomía', icon: <UtensilsCrossed /> },
]

export function etiquetaTipo(tipo: TipoViaje | ''): string {
  return TIPOS.find((t) => t.value === tipo)?.label ?? ''
}

export function iconoTipo(tipo: TipoViaje | ''): ReactNode {
  return TIPOS.find((t) => t.value === tipo)?.icon ?? null
}

/** Límite visual del contador de la descripción (el servidor acepta 2000). */
export const MAX_DESCRIPCION_VISUAL = 600

/** Chips de la estación 00: etiqueta del chip → frase que añaden al texto. */
export const FRASES_DESCRIPCION: readonly { label: string; frase: string }[] = [
  { label: 'Viajo con niños', frase: 'Viajo con niños.' },
  { label: 'Sin madrugar', frase: 'Prefiero no madrugar.' },
  { label: 'Comida local', frase: 'Quiero probar la comida local.' },
  { label: 'Accesible', frase: 'Necesito planes accesibles.' },
  { label: 'Naturaleza', frase: 'Me gusta la naturaleza.' },
  { label: 'Vida nocturna', frase: 'Quiero algo de vida nocturna.' },
]

/** Añade una frase al final del texto (con el punto y espacio justos). */
export function anadirFrase(texto: string, frase: string): string {
  const base = texto.trimEnd()
  if (!base) return frase
  const sep = /[.!?¡¿…]$/.test(base) ? ' ' : '. '
  return `${base}${sep}${frase}`
}

/** Quita una frase del texto (toggle del chip). */
export function quitarFrase(texto: string, frase: string): string {
  return texto
    .replace(frase, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export interface NivelMeta {
  label: string
  estrellas: 3 | 4 | 5
  hoteles: string
  transporte: string
  /** Color del kicker de la versión (§6.4). */
  kicker: string
  /** Rasgo por defecto para «Lo que la hace distinta». */
  rasgo: string
}

export const NIVELES: Record<Paquete, NivelMeta> = {
  basico: {
    label: 'Básico',
    estrellas: 3,
    hoteles: 'Hoteles 3★',
    transporte: 'Transporte público',
    kicker: 'text-accent',
    rasgo: 'Hospedaje sencillo, transporte público y planes de bajo coste',
  },
  confort: {
    label: 'Confort',
    estrellas: 4,
    hoteles: 'Hoteles 4★',
    transporte: 'Taxis y apps',
    kicker: 'text-primary-text',
    rasgo: 'Hoteles bien ubicados y una mezcla de planes locales y destacados',
  },
  premium: {
    label: 'Premium',
    estrellas: 5,
    hoteles: 'Hoteles 5★',
    transporte: 'Traslados privados',
    kicker: 'text-brass-text',
    rasgo: 'Hospedaje de lujo, traslados privados y experiencias exclusivas',
  },
}

export const ORDEN_PAQUETES: readonly Paquete[] = [
  'basico',
  'confort',
  'premium',
]
