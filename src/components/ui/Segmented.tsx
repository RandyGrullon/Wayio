'use client'

import { useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { SPRING } from './motion'

export interface SegmentedOption<T extends string = string> {
  value: T
  label: ReactNode
  /** Texto accesible si label no es texto plano. */
  ariaLabel?: string
  icon?: ReactNode
  disabled?: boolean
}

export interface SegmentedProps<T extends string = string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onValueChange: (valor: T) => void
  /** Nombre accesible del grupo (o labelledBy). */
  label?: string
  labelledBy?: string
  /** md = ítems de 36 (44 en táctil); sm = compacto de 32 (moneda dentro de un input). */
  size?: 'sm' | 'md'
  fullWidth?: boolean
  disabled?: boolean
  className?: string
}

/**
 * Control segmentado (docs/DISENO.md §5.3): radiogroup con thumb que se
 * desliza (layoutId, spring firme). Seleccionado = superficie + text-fg.
 */
export function Segmented<T extends string = string>({
  options,
  value,
  onValueChange,
  label,
  labelledBy,
  size = 'md',
  fullWidth = false,
  disabled = false,
  className,
}: SegmentedProps<T>) {
  const id = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const habilitados = options
    .map((o, i) => (o.disabled || disabled ? -1 : i))
    .filter((i) => i >= 0)

  const mover = (indice: number, delta: number | 'inicio' | 'fin') => {
    if (habilitados.length === 0) return
    let destino: number | undefined
    if (delta === 'inicio') destino = habilitados[0]
    else if (delta === 'fin') destino = habilitados[habilitados.length - 1]
    else {
      const pos = Math.max(0, habilitados.indexOf(indice))
      const n = habilitados.length
      destino = habilitados[(((pos + delta) % n) + n) % n]
    }
    const opcion = destino === undefined ? undefined : options[destino]
    if (destino === undefined || !opcion) return
    refs.current[destino]?.focus()
    onValueChange(opcion.value)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const teclas: Record<string, number | 'inicio' | 'fin'> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
      Home: 'inicio',
      End: 'fin',
    }
    const delta = teclas[e.key]
    if (delta === undefined) return
    e.preventDefault()
    mover(indice, delta)
  }

  const hayValor = options.some((o) => o.value === value)

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-disabled={disabled || undefined}
      className={cn(
        'inline-flex rounded-full bg-surface-2 p-1',
        fullWidth && 'flex w-full',
        className
      )}
    >
      {options.map((o, i) => {
        const activo = o.value === value
        const tabulable = activo || (!hayValor && i === habilitados[0])
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={activo}
            aria-label={o.ariaLabel}
            tabIndex={tabulable ? 0 : -1}
            disabled={disabled || o.disabled}
            onClick={() => onValueChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap',
              'transition-colors duration-(--dur-fast) ease-papel',
              'disabled:cursor-not-allowed disabled:opacity-45',
              '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]',
              size === 'md'
                ? 'h-9 px-4 text-[14px] pointer-coarse:h-11'
                : 'h-8 px-3 text-[13px]',
              fullWidth && 'flex-1',
              activo ? 'text-fg' : 'text-fg-muted hover:text-fg'
            )}
          >
            {activo ? (
              <m.span
                layoutId={`${id}-thumb`}
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-surface shadow-card dark:bg-surface-raised"
                transition={SPRING.firme}
              />
            ) : null}
            {o.icon ? (
              <span aria-hidden="true" className="relative inline-flex">
                {o.icon}
              </span>
            ) : null}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
