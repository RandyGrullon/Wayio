'use client'

import { useId } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { SPRING } from './motion'

export interface SwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'role'
> {
  checked: boolean
  onCheckedChange: (valor: boolean) => void
  /** Etiqueta visible a la izquierda (o usa aria-label). */
  label?: ReactNode
  /** Texto de apoyo bajo la etiqueta. */
  description?: ReactNode
}

/**
 * Interruptor (docs/DISENO.md §5.13): role="switch" aria-checked, pista
 * tinta-500 (apagado) / accent (encendido), thumb de 20 px con spring firme y
 * área táctil de 44. El estado se refuerza con la posición del thumb (no solo
 * con color).
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  className,
  id,
  ...props
}: SwitchProps) {
  const auto = useId()
  const base = id ?? `switch${auto.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const control = (
    <button
      type="button"
      role="switch"
      id={base}
      aria-checked={checked}
      aria-labelledby={label ? `${base}-label` : undefined}
      aria-describedby={description ? `${base}-desc` : undefined}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'group relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5',
        'transition-colors duration-(--dur-fast) ease-papel',
        'after:absolute after:-inset-2.5 disabled:cursor-not-allowed disabled:opacity-45',
        checked ? 'bg-accent' : 'bg-tinta-500 dark:bg-tinta-400',
        !label && className
      )}
      {...props}
    >
      <m.span
        aria-hidden="true"
        className={cn(
          'block size-5 rounded-full bg-surface shadow-card dark:bg-papel-150',
          checked && 'dark:bg-noche-950'
        )}
        initial={false}
        animate={{ x: checked ? 20 : 0 }}
        transition={SPRING.firme}
      />
    </button>
  )

  if (!label) return control

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        {/* El label reenvía el clic al botón (es un elemento etiquetable). */}
        <label
          id={`${base}-label`}
          htmlFor={base}
          className="block cursor-pointer text-[15px] font-medium text-fg"
        >
          {label}
        </label>
        {description ? (
          <span
            id={`${base}-desc`}
            className="mt-0.5 block text-caption text-fg-muted"
          >
            {description}
          </span>
        ) : null}
      </div>
      <div className="pt-0.5">{control}</div>
    </div>
  )
}
