import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'
import { diaClases } from '@/constants/mapColors'

export type AvatarSize = 'sm' | 'md' | 'lg'

const TAMANOS: Record<AvatarSize, string> = {
  // 12 px es el mínimo absoluto de texto (§13.8).
  sm: 'size-6 text-[12px]',
  md: 'size-8 text-[13px]',
  lg: 'size-10 text-[15px]',
}

/** Iniciales de un nombre o email («Ana Pérez» → «AP», «luis@x.com» → «L»). */
export function iniciales(nombre: string | null | undefined): string {
  const limpio = (nombre ?? '').trim().replace(/@.*$/, '')
  if (!limpio) return '?'
  const partes = limpio.split(/[\s._-]+/).filter(Boolean)
  const a = partes[0]?.[0] ?? '?'
  const b = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : ''
  return (a + b).toUpperCase()
}

/** Índice estable (0–9) a partir de un id, para el color del miembro. */
export function indiceDesdeId(id: string | null | undefined): number {
  let h = 0
  for (const c of id ?? '') h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % 10
}

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** Nombre (o email) para las iniciales y el texto accesible. */
  name: string | null | undefined
  /** Índice del miembro: color bg-dia-((index % 10) + 1). */
  index?: number
  size?: AvatarSize
  /** Oculta el nombre a lectores de pantalla (cuando ya va en texto al lado). */
  decorative?: boolean
}

/**
 * Avatar (docs/DISENO.md §5.14): círculo con el color del día del miembro y
 * las iniciales en --dia-num (blanco sobre base, tinta sobre luz).
 */
export function Avatar({
  name,
  index = 0,
  size = 'md',
  decorative = false,
  className,
  ...props
}: AvatarProps) {
  const etiqueta = name?.trim() || 'Miembro'
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : etiqueta}
      aria-hidden={decorative || undefined}
      title={decorative ? undefined : etiqueta}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-semibold text-dia-num select-none',
        diaClases(index).bg,
        TAMANOS[size],
        className
      )}
      {...props}
    >
      <span aria-hidden="true">{iniciales(name)}</span>
    </span>
  )
}

export interface AvatarStackProps {
  people: readonly { name: string | null | undefined; index?: number }[]
  /** Máximo visible antes de «+N» (5 por defecto). */
  max?: number
  size?: AvatarSize
  className?: string
}

/** Pila de avatares: -space-x-2, anillo de 2 px en bg y «+N». */
export function AvatarStack({
  people,
  max = 5,
  size = 'md',
  className,
}: AvatarStackProps) {
  const visibles = people.slice(0, max)
  const resto = people.length - visibles.length
  const nombres = people
    .map((p) => p.name?.trim())
    .filter(Boolean)
    .join(', ')
  return (
    <span
      role="img"
      aria-label={
        nombres ? `Viajeros: ${nombres}` : `${people.length} viajeros`
      }
      className={cn('inline-flex items-center -space-x-2', className)}
    >
      {visibles.map((p, i) => (
        <Avatar
          key={`${p.name ?? ''}-${i}`}
          name={p.name}
          index={p.index ?? i}
          size={size}
          decorative
          className="ring-2 ring-bg"
        />
      ))}
      {resto > 0 ? (
        <span
          aria-hidden="true"
          className={cn(
            'inline-grid shrink-0 place-items-center rounded-full bg-surface-2 font-semibold text-fg-muted ring-2 ring-bg tnum',
            TAMANOS[size]
          )}
        >
          +{resto}
        </span>
      ) : null}
    </span>
  )
}
