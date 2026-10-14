import type { ElementType, HTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Tarjeta (docs/DISENO.md §5.4).
 *
 * - default: filete + superficie blanca.
 * - elevated: + shadow-elev (en oscuro conserva el borde).
 * - interactive: hover con filete medio, -2 px y shadow-elev.
 * - selected: borde de tinta de 2 px (seleccionado = tinta).
 * - nota: «Notas de ruta», fondo latón suave con filete izquierdo.
 * - boleto: sin padding; usa CardFranja, CardFila y CardPerforado.
 * - inverse: tinta (tarjeta AHORA); el foco interior usa ring-inverse.
 * - postal: sin padding; arte arriba (texto nunca encima) y pie con p-5.
 * Alias @deprecated: bordered → default, glass → default.
 */
export type CardVariant =
  | 'default'
  | 'elevated'
  | 'interactive'
  | 'selected'
  | 'nota'
  | 'boleto'
  | 'inverse'
  | 'postal'
  /** @deprecated usa 'default' */
  | 'bordered'
  /** @deprecated usa 'default' */
  | 'glass'

const VARIANTES: Record<CardVariant, string> = {
  default: 'rounded-card border border-border bg-surface p-5 md:p-6',
  bordered: 'rounded-card border border-border bg-surface p-5 md:p-6',
  glass: 'rounded-card border border-border bg-surface p-5 md:p-6',
  elevated:
    'rounded-card border border-border bg-surface p-5 shadow-elev md:p-6',
  interactive: 'rounded-card border border-border bg-surface p-5 md:p-6',
  selected: 'rounded-card border-2 border-fg bg-surface p-[19px] md:p-[23px]',
  nota: 'rounded-card border-l-[3px] border-brass bg-brass-soft p-5 text-brass-soft-fg',
  boleto: 'overflow-hidden rounded-card border border-border bg-surface',
  inverse:
    'rounded-card bg-surface-inverse p-5 text-fg-inverse [&_:focus-visible]:outline-ring-inverse',
  postal: 'overflow-hidden rounded-card border border-border bg-surface',
}

const INTERACTIVA =
  'transition-[border-color,box-shadow,transform] duration-(--dur-base) ease-papel hover:-translate-y-0.5 hover:border-rule hover:shadow-elev focus-visible:outline-ring'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: CardVariant
  /** Añade el hover de tarjeta interactiva a cualquier variante. */
  interactive?: boolean
  /** Elemento raíz (div por defecto: article, section, li…). */
  as?: ElementType
  ref?: Ref<HTMLElement>
}

export function Card({
  variant = 'default',
  interactive = false,
  as: Componente = 'div',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <Componente
      className={cn(
        VARIANTES[variant],
        (interactive || variant === 'interactive') && INTERACTIVA,
        className
      )}
      {...props}
    >
      {children}
    </Componente>
  )
}

/** Franja superior de tinta del boleto («WAYIO · TU RUTA»). */
export function CardFranja({
  children,
  className,
  extra,
}: {
  children: ReactNode
  className?: string
  /** Contenido alineado a la derecha de la franja. */
  extra?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex h-9 items-center justify-between gap-3 bg-surface-inverse px-5 text-overline tracking-[0.14em] text-fg-inverse uppercase [font-stretch:85%]',
        className
      )}
    >
      <span>{children}</span>
      {extra ? <span className="tnum">{extra}</span> : null}
    </div>
  )
}

/** Lista de filas del boleto (<dl>); cada hijo es un CardFila. */
export function CardFilas({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <dl className={cn('divide-y divide-border py-1', className)}>{children}</dl>
  )
}

/** Fila etiqueta/valor del boleto: kicker + valor en Newsreader 20 px.
 * Va dentro de CardFilas (<dl>). */
export function CardFila({
  etiqueta,
  children,
  icon,
  className,
}: {
  etiqueta: string
  children: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('px-5 py-3', className)}>
      <dt className="kicker">{etiqueta}</dt>
      <dd className="mt-1 flex items-center gap-2 font-display text-[20px] leading-tight text-fg [&_svg]:size-[18px] [&_svg]:stroke-[1.75]">
        {icon ? (
          <span aria-hidden="true" className="inline-flex text-fg-subtle">
            {icon}
          </span>
        ) : null}
        {children}
      </dd>
    </div>
  )
}

/** Divisor perforado con muescas (la Card boleto lleva overflow-hidden). */
export function CardPerforado({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      aria-hidden="true"
      className={cn('perforado mx-0', className)}
    />
  )
}

/** Kicker de la nota («NOTAS DE RUTA») en latón. */
export function CardKicker({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <p className={cn('kicker text-brass-text', className)}>{children}</p>
}
