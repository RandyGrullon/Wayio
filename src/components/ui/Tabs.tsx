'use client'

import { createContext, useContext, useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { diaClases } from '@/constants/mapColors'
import { SPRING } from './motion'

/**
 * Pestañas (docs/DISENO.md §5.7): tablist/tab/tabpanel con tabindex
 * itinerante, flechas, Home y End (activación automática). Indicador de tinta
 * (layoutId, spring firme). variant 'chip' = chips de día (seleccionado =
 * tinta; el punto conserva su color).
 */

interface TabsContexto {
  base: string
  value: string
  onValueChange: (valor: string) => void
  variant: 'linea' | 'chip'
}

const Contexto = createContext<TabsContexto | null>(null)

function useTabs(): TabsContexto {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('Tab y TabPanel deben ir dentro de <Tabs>.')
  return ctx
}

const limpiar = (v: string) => v.replace(/[^a-zA-Z0-9_-]/g, '-')

export interface TabsProps {
  value: string
  onValueChange: (valor: string) => void
  variant?: 'linea' | 'chip'
  /** Prefijo de ids estable (por defecto, useId). */
  id?: string
  children: ReactNode
  className?: string
}

export function Tabs({
  value,
  onValueChange,
  variant = 'linea',
  id,
  children,
  className,
}: TabsProps) {
  const auto = useId()
  const base = limpiar(id ?? `tabs${auto}`)
  return (
    <Contexto.Provider value={{ base, value, onValueChange, variant }}>
      <div className={className}>{children}</div>
    </Contexto.Provider>
  )
}

export interface TabListProps {
  /** Nombre accesible de la lista. */
  label: string
  children: ReactNode
  className?: string
}

export function TabList({ label, children, className }: TabListProps) {
  const { variant } = useTabs()
  const ref = useRef<HTMLDivElement | null>(null)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const lista = ref.current
    if (!lista) return
    const tabs = Array.from(
      lista.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
    )
    const actual = tabs.findIndex((t) => t === document.activeElement)
    if (actual < 0) return
    let destino: number | null = null
    if (e.key === 'ArrowRight') destino = (actual + 1) % tabs.length
    else if (e.key === 'ArrowLeft')
      destino = (actual - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') destino = 0
    else if (e.key === 'End') destino = tabs.length - 1
    if (destino === null) return
    e.preventDefault()
    const tab = tabs[destino]
    tab?.focus()
    tab?.click()
  }

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn(
        'relative flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        // Fundido de 24 px en los bordes en móvil (hay más pestañas al deslizar).
        '[mask-image:linear-gradient(to_right,transparent,#000_24px,#000_calc(100%-24px),transparent)] md:[mask-image:none]',
        variant === 'linea' ? 'gap-6 border-b border-border' : 'gap-2 py-1',
        className
      )}
    >
      {children}
    </div>
  )
}

export interface TabProps {
  value: string
  children: ReactNode
  /** Contador opcional en un Badge default («Chat 3»). */
  count?: number
  /** Chips de día: número de día (1…) para el punto bg-dia-N. */
  dia?: number
  icon?: ReactNode
  disabled?: boolean
  className?: string
}

export function Tab({
  value,
  children,
  count,
  dia,
  icon,
  disabled = false,
  className,
}: TabProps) {
  const { base, value: activo, onValueChange, variant } = useTabs()
  const seleccionado = activo === value
  const clave = limpiar(value)
  return (
    <button
      type="button"
      role="tab"
      id={`${base}-tab-${clave}`}
      aria-selected={seleccionado}
      aria-controls={`${base}-panel-${clave}`}
      tabIndex={seleccionado ? 0 : -1}
      disabled={disabled}
      onClick={() => onValueChange(value)}
      className={cn(
        // `group`: los hijos pueden reaccionar a la selección
        // (p. ej. la fecha «sáb 12» con group-aria-selected:text-fg-inverse/80).
        'group relative inline-flex shrink-0 items-center gap-2 font-semibold whitespace-nowrap',
        'transition-colors duration-(--dur-fast) ease-papel disabled:cursor-not-allowed disabled:opacity-45',
        '[&_svg]:size-4 [&_svg]:stroke-[1.75]',
        variant === 'linea'
          ? 'h-12 text-[15px] text-fg-muted hover:text-fg aria-selected:text-fg focus-visible:outline-offset-[-2px]'
          : cn(
              'h-9 rounded-full border px-3 text-[14px] tnum',
              seleccionado
                ? 'border-surface-inverse bg-surface-inverse text-fg-inverse'
                : 'border-border-strong bg-surface text-fg hover:bg-surface-2'
            ),
        className
      )}
    >
      {dia !== undefined ? (
        <span
          aria-hidden="true"
          className={cn('size-2 shrink-0 rounded-full', diaClases(dia - 1).bg)}
        />
      ) : null}
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      {children}
      {count !== undefined ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-stamp bg-surface-2 px-1.5 text-[12px] font-semibold text-fg-muted tnum">
          {count}
        </span>
      ) : null}
      {variant === 'linea' && seleccionado ? (
        <m.span
          layoutId={`${base}-indicador`}
          aria-hidden="true"
          className="absolute inset-x-0 -bottom-px h-0.5 bg-fg"
          transition={SPRING.firme}
        />
      ) : null}
    </button>
  )
}

export interface TabPanelProps {
  value: string
  children: ReactNode
  /** Mantiene el panel montado (oculto) al cambiar de pestaña. */
  keepMounted?: boolean
  className?: string
}

export function TabPanel({
  value,
  children,
  keepMounted = false,
  className,
}: TabPanelProps) {
  const { base, value: activo } = useTabs()
  const seleccionado = activo === value
  if (!seleccionado && !keepMounted) return null
  const clave = limpiar(value)
  return (
    <div
      role="tabpanel"
      id={`${base}-panel-${clave}`}
      aria-labelledby={`${base}-tab-${clave}`}
      hidden={!seleccionado}
      tabIndex={0}
      className={cn('focus-visible:outline-offset-4', className)}
    >
      {children}
    </div>
  )
}
