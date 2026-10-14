'use client'

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import Link from 'next/link'
import { AnimatePresence, m } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { buttonClasses } from './Button'
import { EASE } from './motion'

export interface MenuItem {
  key: string
  label: string
  icon?: ReactNode
  /** Navega (next/link) en lugar de ejecutar onSelect. */
  href?: string
  onSelect?: () => void
  tone?: 'default' | 'danger'
  /** Si se define, el ítem es menuitemradio con aria-checked. */
  checked?: boolean
  disabled?: boolean
  /** Línea divisoria antes del ítem (acciones destructivas al final). */
  separatorBefore?: boolean
}

export interface MenuProps {
  items: readonly MenuItem[]
  /** Nombre accesible del disparador y del menú. */
  label: string
  /** Contenido del disparador (icono, avatar…). */
  trigger: ReactNode
  /** Clases del disparador (por defecto, ghost icon). */
  triggerClassName?: string
  align?: 'start' | 'end'
  /** Cabecera no interactiva (nombre y email del usuario). */
  header?: ReactNode
  className?: string
}

function itemsDe(panel: HTMLElement | null): HTMLElement[] {
  return Array.from(
    panel?.querySelectorAll<HTMLElement>(
      '[role^="menuitem"]:not([aria-disabled="true"])'
    ) ?? []
  )
}

/**
 * Menú desplegable accesible: botón con aria-haspopup, role="menu", flechas,
 * Home/End, Esc devuelve el foco al disparador y clic fuera lo cierra.
 */
export function Menu({
  items,
  label,
  trigger,
  triggerClassName,
  align = 'end',
  header,
  className,
}: MenuProps) {
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLDivElement | null>(null)
  const boton = useRef<HTMLButtonElement | null>(null)
  const panel = useRef<HTMLDivElement | null>(null)
  const focoInicial = useRef<'primero' | 'ultimo'>('primero')

  const elementos = () => itemsDe(panel.current)

  const cerrar = useCallback((devolverFoco: boolean) => {
    setAbierto(false)
    if (devolverFoco) boton.current?.focus()
  }, [])

  // Clic fuera.
  useEffect(() => {
    if (!abierto) return
    const onDown = (e: PointerEvent) => {
      if (
        raiz.current &&
        e.target instanceof Node &&
        !raiz.current.contains(e.target)
      ) {
        setAbierto(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [abierto])

  // Foco al abrir.
  useEffect(() => {
    if (!abierto) return
    const frame = requestAnimationFrame(() => {
      const lista = itemsDe(panel.current)
      const destino =
        focoInicial.current === 'ultimo' ? lista[lista.length - 1] : lista[0]
      destino?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [abierto])

  const abrirCon = (foco: 'primero' | 'ultimo') => {
    focoInicial.current = foco
    setAbierto(true)
  }

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    // Enter y Espacio ya disparan el clic del botón (abre con foco al primero).
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      abrirCon('primero')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      abrirCon('ultimo')
    }
  }

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const lista = elementos()
    const actual = lista.findIndex((el) => el === document.activeElement)
    const ir = (i: number) => {
      e.preventDefault()
      lista[(i + lista.length) % lista.length]?.focus()
    }
    switch (e.key) {
      case 'ArrowDown':
        ir(actual + 1)
        break
      case 'ArrowUp':
        ir(actual - 1)
        break
      case 'Home':
        ir(0)
        break
      case 'End':
        ir(lista.length - 1)
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        cerrar(true)
        break
      case 'Tab':
        setAbierto(false)
        break
      default:
        break
    }
  }

  const claseItem = (item: MenuItem) =>
    cn(
      'flex h-10 w-full items-center gap-2.5 rounded-[8px] px-3 text-left text-[14px] font-medium',
      'transition-colors duration-(--dur-fast) hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-offset-[-2px]',
      '[&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:stroke-[1.75]',
      item.tone === 'danger' ? 'text-danger' : 'text-fg',
      item.disabled && 'pointer-events-none opacity-45'
    )

  return (
    <div ref={raiz} className="relative inline-flex">
      <button
        ref={boton}
        type="button"
        id={`${id}-boton`}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? `${id}-menu` : undefined}
        onClick={() => (abierto ? cerrar(false) : abrirCon('primero'))}
        onKeyDown={onTriggerKeyDown}
        className={
          triggerClassName ?? buttonClasses({ variant: 'ghost', size: 'icon' })
        }
      >
        {trigger}
      </button>
      <AnimatePresence>
        {abierto ? (
          <m.div
            ref={panel}
            id={`${id}-menu`}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 0.16, ease: EASE.papel },
            }}
            exit={{
              opacity: 0,
              transition: { duration: 0.12, ease: EASE.salida },
            }}
            className={cn(
              'absolute top-full z-(--z-dropdown) mt-2 min-w-52 origin-top rounded-control border border-border bg-surface-raised p-1.5 shadow-float',
              align === 'end'
                ? 'right-0 origin-top-right'
                : 'left-0 origin-top-left',
              className
            )}
          >
            {header ? (
              <div className="mb-1 border-b border-border px-3 pt-1.5 pb-2.5">
                {header}
              </div>
            ) : null}
            {items.map((item) => {
              const rol =
                item.checked === undefined ? 'menuitem' : 'menuitemradio'
              const contenido = (
                <>
                  {item.icon ? (
                    <span
                      aria-hidden="true"
                      className="inline-flex text-fg-muted"
                    >
                      {item.icon}
                    </span>
                  ) : null}
                  <span className="flex-1">{item.label}</span>
                  {item.checked ? (
                    <Check aria-hidden="true" className="text-fg" />
                  ) : null}
                </>
              )
              // Fragment (no div): los hijos de role="menu" deben ser los
              // propios menuitem/separator.
              return (
                <Fragment key={item.key}>
                  {item.separatorBefore ? (
                    <div role="separator" className="my-1 h-px bg-border" />
                  ) : null}
                  {item.href && !item.disabled ? (
                    <Link
                      href={item.href}
                      role={rol}
                      tabIndex={-1}
                      aria-checked={item.checked}
                      className={claseItem(item)}
                      onClick={() => {
                        item.onSelect?.()
                        cerrar(false)
                      }}
                    >
                      {contenido}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      role={rol}
                      tabIndex={-1}
                      aria-checked={item.checked}
                      aria-disabled={item.disabled || undefined}
                      className={claseItem(item)}
                      onClick={() => {
                        if (item.disabled) return
                        item.onSelect?.()
                        cerrar(true)
                      }}
                    >
                      {contenido}
                    </button>
                  )}
                </Fragment>
              )
            })}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
