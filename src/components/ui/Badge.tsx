import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Badge (docs/DISENO.md §5.5). Se mantiene la API antigua (default | brand |
 * accent | success | warning | error) y se añaden info, laton y sello.
 * Etiquetas siempre en español.
 */
export type BadgeVariant =
  | 'default'
  | 'brand'
  | 'accent'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'laton'
  | 'sello'

export type SelloTone = 'tinta' | 'laton' | 'rosa' | 'exito' | 'peligro'

const VARIANTES: Record<BadgeVariant, string> = {
  default: 'bg-surface-2 text-fg-muted',
  brand: 'bg-accent-soft text-accent-soft-fg',
  accent: 'bg-primary-soft text-primary-soft-fg',
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  error: 'bg-danger-bg text-danger-fg',
  info: 'bg-info-bg text-info-fg',
  laton: 'bg-brass-soft text-brass-soft-fg',
  sello: '',
}

const SELLO_TONOS: Record<SelloTone, string> = {
  tinta: 'text-fg',
  laton: 'text-brass-text',
  rosa: 'text-primary-text',
  exito: 'text-success',
  peligro: 'text-danger',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  /** Color del sello cuando variant="sello". */
  selloTone?: SelloTone
}

export function Badge({
  variant = 'default',
  selloTone = 'tinta',
  className,
  children,
  ...props
}: BadgeProps) {
  if (variant === 'sello') {
    return (
      <SelloInfo tone={selloTone} className={className} {...props}>
        {children}
      </SelloInfo>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-stamp px-2 text-[12px] font-semibold tracking-[0.02em] whitespace-nowrap [&_svg]:size-3.5 [&_svg]:stroke-[1.75]',
        VARIANTES[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export interface SelloInfoProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: SelloTone
  icon?: ReactNode
}

/**
 * Sello informativo: 12 px, mayúsculas semicondensadas, SIN rotar
 * («GUARDADO», «SOLO LECTURA», «DISPONIBLE SIN CONEXIÓN»). El sello
 * decorativo rotado vive en src/components/brand/Sello.tsx.
 */
export function SelloInfo({
  tone = 'tinta',
  icon,
  className,
  children,
  ...props
}: SelloInfoProps) {
  return (
    <span
      className={cn(
        'sello whitespace-nowrap [&_svg]:size-3.5 [&_svg]:stroke-[2]',
        SELLO_TONOS[tone],
        className
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  )
}

// ─── Estados en español (§5.5) ────────────────────────────────────────────

export interface EstadoBadgeDef {
  variant: BadgeVariant
  label: string
}

/** Estado de un viaje → Badge. */
export const BADGE_VIAJE: Record<string, EstadoBadgeDef> = {
  planificando: { variant: 'info', label: 'Planificando' },
  en_viaje: { variant: 'accent', label: 'En viaje' },
  completado: { variant: 'success', label: 'Completado' },
  cancelado: { variant: 'default', label: 'Cancelado' },
}

/** Estado de una suscripción (Stripe) → Badge. */
export const BADGE_SUSCRIPCION: Record<string, EstadoBadgeDef> = {
  active: { variant: 'success', label: 'Activa' },
  trialing: { variant: 'info', label: 'En prueba' },
  past_due: { variant: 'warning', label: 'Pago pendiente' },
  canceled: { variant: 'default', label: 'Cancelada' },
}

/** Badge de estado de viaje o suscripción con fallback legible. */
export function EstadoBadge({
  tipo,
  estado,
  className,
}: {
  tipo: 'viaje' | 'suscripcion'
  estado: string | null | undefined
  className?: string
}) {
  const tabla = tipo === 'viaje' ? BADGE_VIAJE : BADGE_SUSCRIPCION
  const conocido = estado ? tabla[estado] : undefined
  const variant = conocido?.variant ?? 'default'
  const label =
    conocido?.label ??
    (estado
      ? estado.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
      : '—')
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  )
}
