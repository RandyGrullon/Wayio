'use client'

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import type { ReactElement, ReactNode } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { DUR, EASE } from './motion'

export interface TooltipProps {
  /** Texto del tooltip (complementa, nunca sustituye al aria-label). */
  content: ReactNode
  /** Un único elemento enfocable (botón, enlace). */
  children: ReactElement<{ 'aria-describedby'?: string | undefined }>
  side?: 'top' | 'bottom'
  /** Retardo de apertura en hover (ms). El foco abre al instante. */
  delay?: number
  className?: string
}

/**
 * Tooltip de tinta (docs/DISENO.md §5.13 BarChart): aparece con hover y con
 * foco, se cierra con Esc (WCAG 1.4.13) y enlaza aria-describedby.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 250,
  className,
}: TooltipProps) {
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  const timer = useRef<number | null>(null)

  const limpiar = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  const abrir = (inmediato: boolean) => {
    limpiar()
    if (inmediato) setAbierto(true)
    else timer.current = window.setTimeout(() => setAbierto(true), delay)
  }
  const cerrar = () => {
    limpiar()
    setAbierto(false)
  }
  // Al salir el puntero se espera un poco: el tooltip se puede recorrer con el
  // ratón sin que desaparezca (WCAG 1.4.13, «hoverable»).
  const cerrarConRetardo = () => {
    limpiar()
    timer.current = window.setTimeout(() => setAbierto(false), 120)
  }

  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [abierto])

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    []
  )

  const disparador = isValidElement(children)
    ? cloneElement(children, {
        'aria-describedby':
          [children.props['aria-describedby'], abierto ? id : undefined]
            .filter(Boolean)
            .join(' ') || undefined,
      })
    : children

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={() => (abierto ? limpiar() : abrir(false))}
      onPointerLeave={cerrarConRetardo}
      onFocusCapture={() => abrir(true)}
      onBlurCapture={cerrar}
    >
      {disparador}
      <AnimatePresence>
        {abierto ? (
          <m.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: side === 'top' ? 4 : -4 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { duration: DUR.base, ease: EASE.papel },
            }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className={cn(
              'absolute left-1/2 z-(--z-tooltip) w-max max-w-[240px] -translate-x-1/2 rounded-control bg-surface-inverse px-2.5 py-1.5 text-[13px] leading-snug font-medium text-fg-inverse shadow-elev',
              // Puente invisible sobre el hueco de 8 px hasta el disparador.
              "before:absolute before:inset-x-0 before:h-2 before:content-['']",
              side === 'top'
                ? 'bottom-full mb-2 before:top-full'
                : 'top-full mt-2 before:bottom-full',
              className
            )}
          >
            {content}
          </m.span>
        ) : null}
      </AnimatePresence>
    </span>
  )
}
