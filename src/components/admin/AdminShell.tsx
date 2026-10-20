'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'framer-motion'
import { Menu as MenuIcon, X } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { DUR, EASE } from '@/components/ui/motion'
import { BusquedaPanel } from './BusquedaPanel'
import { Migas } from './Migas'
import { PanelProvider } from './PanelContext'
import { Sidebar } from './Sidebar'

/**
 * Marco del panel (docs/DISENO.md §6.12): sidebar fijo de 248 px desde lg,
 * topbar de 56 px con migas, búsqueda ⌘K y tema, y contenido max-w-admin.
 * Por debajo de lg el sidebar pasa a un drawer con hamburguesa.
 */
export function AdminShell({
  email,
  userId,
  demo,
  dueno,
  children,
}: {
  email: string
  userId: string
  demo: boolean
  /** ¿Es el dueño? Muestra las secciones solo para él (Rentabilidad). */
  dueno: boolean
  children: ReactNode
}) {
  const [menu, setMenu] = useState(false)

  return (
    <PanelProvider value={{ userId, email, demo, esDueno: dueno }}>
      <div className="flex min-h-dvh flex-1 bg-bg">
        <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 border-r border-border bg-surface lg:block">
          <Sidebar email={email} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-(--z-header) flex h-14 shrink-0 items-center gap-2 border-b border-border bg-bg/88 px-2 backdrop-blur-header sm:px-4 lg:px-8">
            <IconButton
              label="Abrir menú del panel"
              aria-haspopup="dialog"
              aria-expanded={menu}
              className="shrink-0 lg:hidden"
              onClick={() => setMenu(true)}
            >
              <MenuIcon strokeWidth={1.75} />
            </IconButton>
            <Migas className="flex-1" />
            <div className="flex shrink-0 items-center justify-end gap-1 md:min-w-[300px]">
              <BusquedaPanel />
              <ThemeToggle />
            </div>
          </header>

          <main
            id="contenido"
            tabIndex={-1}
            className="mx-auto w-full max-w-admin flex-1 px-4 pt-6 pb-16 focus:outline-none sm:px-6 lg:px-8 lg:pt-8"
          >
            {demo ? (
              <Callout tone="warning" title="Vista de ejemplo" className="mb-6">
                Este entorno no tiene la base de datos conectada: los datos son
                ficticios y los cambios no se guardan.
              </Callout>
            ) : null}
            {children}
          </main>
        </div>
      </div>

      <DrawerNav abierto={menu} onCerrar={() => setMenu(false)}>
        <Sidebar email={email} onNavegar={() => setMenu(false)} />
      </DrawerNav>
    </PanelProvider>
  )
}

// ─── Drawer izquierdo (móvil y tablet) ────────────────────────────────────

const sinSuscripcion = () => () => {}
const enCliente = () => true
const enServidor = () => false

const ENFOCABLES =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

function DrawerNav({
  abierto,
  onCerrar,
  children,
}: {
  abierto: boolean
  onCerrar: () => void
  children: ReactNode
}) {
  const montado = useSyncExternalStore(sinSuscripcion, enCliente, enServidor)
  if (!montado) return null
  return createPortal(
    <AnimatePresence>
      {abierto ? (
        <PanelDrawer key="drawer-admin" onCerrar={onCerrar}>
          {children}
        </PanelDrawer>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}

function PanelDrawer({
  onCerrar,
  children,
}: {
  onCerrar: () => void
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement | null>(null)
  const cerrarRef = useRef(onCerrar)
  useEffect(() => {
    cerrarRef.current = onCerrar
  }, [onCerrar])

  // Foco al ítem activo, bloqueo de scroll y devolución del foco al cerrar.
  useEffect(() => {
    const previo =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => {
      const raiz = panel.current
      const destino =
        raiz?.querySelector<HTMLElement>('[aria-current="page"]') ??
        raiz?.querySelector<HTMLElement>(ENFOCABLES) ??
        raiz
      destino?.focus({ preventScroll: true })
    })
    // Si el viewport crece hasta lg, el drawer sobra.
    const mq = window.matchMedia('(min-width: 1024px)')
    const onCambio = () => {
      if (mq.matches) cerrarRef.current()
    }
    mq.addEventListener('change', onCambio)
    return () => {
      cancelAnimationFrame(frame)
      mq.removeEventListener('change', onCambio)
      document.body.style.overflow = overflow
      if (previo && document.contains(previo)) {
        previo.focus({ preventScroll: true })
      }
    }
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      cerrarRef.current()
      return
    }
    if (e.key !== 'Tab') return
    const raiz = panel.current
    if (!raiz) return
    const items = Array.from(
      raiz.querySelectorAll<HTMLElement>(ENFOCABLES)
    ).filter((el) => el.getClientRects().length > 0)
    const primero = items[0]
    const ultimo = items[items.length - 1]
    if (!primero || !ultimo) return
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primero.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-(--z-modal) lg:hidden">
      <m.div
        aria-hidden="true"
        className="absolute inset-0 bg-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: DUR.base } }}
        exit={{ opacity: 0, transition: { duration: 0.16 } }}
        onClick={() => cerrarRef.current()}
      />
      <m.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Menú del panel"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        initial={{ x: '-100%' }}
        animate={{ x: 0, transition: { duration: 0.38, ease: EASE.papel } }}
        exit={{ x: '-100%', transition: { duration: 0.24, ease: EASE.salida } }}
        className="absolute inset-y-0 left-0 flex w-[min(300px,calc(100vw-48px))] flex-col rounded-r-sheet bg-surface shadow-float focus-visible:outline-none dark:border-r dark:border-border"
      >
        <IconButton
          label="Cerrar menú"
          className="absolute top-1.5 right-1.5 z-10"
          onClick={() => cerrarRef.current()}
        >
          <X strokeWidth={1.75} />
        </IconButton>
        {children}
      </m.div>
    </div>
  )
}
