'use client'

import { useRef, useState } from 'react'
import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode, Ref } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { DUR, EASE } from './motion'

export type ChipSize = 'sm' | 'md'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Seleccionado: fondo tinta y Check (docs/DISENO.md §5.3). */
  selected?: boolean
  /** Icono lucide de 18 px; se sustituye por Check al seleccionar. */
  icon?: ReactNode
  /** md = 40 (elección), sm = 36 (filtros, sugerencias). */
  size?: ChipSize
  /** Contador opcional (chips de filtro del admin). */
  count?: number
  ref?: Ref<HTMLButtonElement>
}

const TAMANO: Record<ChipSize, string> = {
  md: 'h-10 px-4 text-[15px]',
  sm: 'h-9 px-3 text-[14px]',
}

/**
 * Chip. Sin `role` es un botón de acción (sugerencias «Sorpréndeme»); con
 * `selected` y sin role propio se comporta como toggle (aria-pressed). Dentro
 * de ChipGroup recibe role radio/checkbox y aria-checked.
 */
export function Chip({
  selected = false,
  icon,
  size = 'md',
  count,
  className,
  children,
  role,
  type = 'button',
  ref,
  ...props
}: ChipProps) {
  const esOpcion = role === 'radio' || role === 'checkbox'
  const estado = esOpcion
    ? { 'aria-checked': selected }
    : props['aria-pressed'] !== undefined || selected
      ? { 'aria-pressed': selected }
      : {}
  return (
    <button
      ref={ref}
      type={type}
      role={role}
      data-selected={selected || undefined}
      className={cn(
        'relative inline-flex shrink-0 select-none items-center gap-2 rounded-full border border-border-strong bg-surface font-medium text-fg',
        'transition-[background-color,color,border-color] duration-(--dur-fast) ease-papel hover:bg-surface-2',
        'data-[selected]:border-surface-inverse data-[selected]:text-fg-inverse',
        'disabled:cursor-not-allowed disabled:opacity-45',
        '[&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:stroke-[1.75]',
        TAMANO[size],
        className
      )}
      {...estado}
      {...props}
    >
      <AnimatePresence initial={false}>
        {selected ? (
          <m.span
            key="fondo"
            aria-hidden="true"
            className="absolute -inset-px rounded-full bg-surface-inverse"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.base, ease: EASE.papel }}
          />
        ) : null}
      </AnimatePresence>
      {selected ? (
        <m.span
          key="check"
          aria-hidden="true"
          className="relative inline-flex"
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.16, ease: EASE.sello }}
        >
          <Check />
        </m.span>
      ) : icon ? (
        <span aria-hidden="true" className="relative inline-flex">
          {icon}
        </span>
      ) : null}
      <span className="relative">{children}</span>
      {count !== undefined ? (
        <span
          className={cn(
            'relative inline-flex h-5 min-w-5 items-center justify-center rounded-stamp px-1.5 text-[12px] font-semibold tnum',
            selected
              ? 'bg-fg-inverse/15 text-fg-inverse'
              : 'bg-surface-2 text-fg-muted'
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  )
}

export interface ChipOption {
  value: string
  label: string
  icon?: ReactNode
  disabled?: boolean
  count?: number
}

interface ChipGroupBase {
  options: readonly ChipOption[]
  /** Nombre accesible del grupo (o usa labelledBy). */
  label?: string
  labelledBy?: string
  /** id(s) del texto que describe el grupo (p. ej. su mensaje de error). */
  'aria-describedby'?: string | undefined
  /**
   * Grupo con error. En el radiogroup va en el propio grupo; en 'multiple'
   * (role="group", que no lo admite en ARIA 1.2) va en cada checkbox.
   */
  'aria-invalid'?: boolean | undefined
  size?: ChipSize
  className?: string
  disabled?: boolean
}

export interface ChipGroupSingleProps extends ChipGroupBase {
  type?: 'single'
  value: string | null | undefined
  onValueChange: (valor: string) => void
}

export interface ChipGroupMultipleProps extends ChipGroupBase {
  type: 'multiple'
  value: readonly string[]
  onValueChange: (valores: string[]) => void
}

export type ChipGroupProps = ChipGroupSingleProps | ChipGroupMultipleProps

/**
 * Grupo de chips con tabindex itinerante y flechas (docs/DISENO.md §5.3).
 * type 'single' (por defecto) = radiogroup; 'multiple' = toggles (checkbox).
 * Disposición flex-wrap con gap-2 (nunca un grid con huérfanos).
 */
export function ChipGroup(props: ChipGroupProps) {
  const {
    options,
    label,
    labelledBy,
    'aria-describedby': describedBy,
    'aria-invalid': ariaInvalid,
    size = 'md',
    className,
    disabled,
  } = props
  const multiple = props.type === 'multiple'
  const invalido = ariaInvalid === true
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const [foco, setFoco] = useState<number | null>(null)

  const estaSeleccionado = (valor: string): boolean =>
    props.type === 'multiple'
      ? props.value.includes(valor)
      : props.value === valor

  const habilitados = options
    .map((o, i) => (o.disabled || disabled ? -1 : i))
    .filter((i) => i >= 0)
  const indiceSeleccionado = options.findIndex((o) => estaSeleccionado(o.value))
  const tabulable =
    foco ??
    (!multiple && indiceSeleccionado >= 0
      ? indiceSeleccionado
      : (habilitados[0] ?? 0))

  const seleccionar = (indice: number) => {
    const opcion = options[indice]
    if (!opcion) return
    if (props.type === 'multiple') {
      const ya = props.value.includes(opcion.value)
      props.onValueChange(
        ya
          ? props.value.filter((v) => v !== opcion.value)
          : [...props.value, opcion.value]
      )
    } else {
      props.onValueChange(opcion.value)
    }
  }

  const mover = (desde: number, delta: number | 'inicio' | 'fin') => {
    if (habilitados.length === 0) return
    let destino: number | undefined
    if (delta === 'inicio') destino = habilitados[0]
    else if (delta === 'fin') destino = habilitados[habilitados.length - 1]
    else {
      const pos = habilitados.indexOf(desde)
      const n = habilitados.length
      destino = habilitados[((((pos < 0 ? 0 : pos) + delta) % n) + n) % n]
    }
    if (destino === undefined) return
    setFoco(destino)
    refs.current[destino]?.focus()
    // En un radiogroup, mover con flechas también selecciona.
    if (!multiple) seleccionar(destino)
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

  return (
    <div
      role={multiple ? 'group' : 'radiogroup'}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy || undefined}
      {...(!multiple && invalido ? { 'aria-invalid': true } : {})}
      className={cn(
        'flex flex-wrap gap-2',
        // Con error, el filete de los chips sin elegir pasa a --danger.
        invalido && '[&>button:not([data-selected])]:border-danger',
        className
      )}
    >
      {options.map((o, i) => (
        <Chip
          key={o.value}
          ref={(el) => {
            refs.current[i] = el
          }}
          role={multiple ? 'checkbox' : 'radio'}
          {...(multiple && invalido ? { 'aria-invalid': true } : {})}
          selected={estaSeleccionado(o.value)}
          icon={o.icon}
          size={size}
          disabled={disabled || o.disabled}
          tabIndex={i === tabulable ? 0 : -1}
          onFocus={() => setFoco(i)}
          onKeyDown={(e) => onKeyDown(e, i)}
          onClick={() => seleccionar(i)}
          {...(o.count === undefined ? {} : { count: o.count })}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  )
}
