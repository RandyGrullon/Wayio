'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m, useDragControls } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from './Button'
import { DUR, EASE } from './motion'

/**
 * Modal, Sheet, Drawer y ConfirmDialog (docs/DISENO.md §5.6).
 *
 * - Portal a <body>, role="dialog" aria-modal, aria-labelledby/-describedby.
 * - Focus trap, Esc, clic en el velo y devolución del foco al cerrar.
 * - Bloqueo del scroll (con contador para diálogos anidados).
 * - variant 'auto': sheet por debajo de 640 px y modal desde 640.
 *   'drawer': panel derecho de 420 desde 1024 (sheet por debajo).
 * - Sheet: se cierra arrastrando desde el asa más del 30 % o a >500 px/s.
 */

export type ModalVariant = 'auto' | 'modal' | 'sheet' | 'drawer'

const ENFOCABLES =
  'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),iframe,[contenteditable="true"],[tabindex]:not([tabindex="-1"])'

// ─── Utilidades de módulo ─────────────────────────────────────────────────

const sinSuscripcion = () => () => {}
const enCliente = () => true
const enServidor = () => false

function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    [query]
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  )
}

let bloqueos = 0
function bloquearScroll(): () => void {
  bloqueos += 1
  if (bloqueos === 1) {
    const barra = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (barra > 0) document.body.style.paddingRight = `${barra}px`
  }
  return () => {
    bloqueos = Math.max(0, bloqueos - 1)
    if (bloqueos === 0) {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }
}

/** Pila de diálogos abiertos: solo el de arriba atrapa el foco. */
const pila: string[] = []

// ─── Modal ────────────────────────────────────────────────────────────────

export interface ModalProps {
  open: boolean
  onClose: () => void
  /** Título visible (font-display text-h3); da nombre al diálogo. */
  title?: ReactNode
  /** Consecuencia o contexto bajo el título (aria-describedby). */
  description?: ReactNode
  children?: ReactNode
  /** Pie de acciones (flex justify-end gap-3: cancelar outline, principal a la derecha). */
  footer?: ReactNode
  variant?: ModalVariant
  /** md = 560 px, lg = 720 px (solo modal). */
  size?: 'md' | 'lg'
  /** Nombre accesible si no hay título visible. */
  ariaLabel?: string
  /** Elemento que recibe el foco al abrir (si no, [data-autofocus] o el panel). */
  initialFocus?: RefObject<HTMLElement | null>
  closeOnOverlay?: boolean
  showClose?: boolean
  className?: string
  bodyClassName?: string
}

export function Modal(props: ModalProps) {
  const montado = useSyncExternalStore(sinSuscripcion, enCliente, enServidor)
  if (!montado) return null
  return createPortal(
    <AnimatePresence>
      {props.open ? <PanelDialogo key="wy-dialogo" {...props} /> : null}
    </AnimatePresence>,
    document.body
  )
}

function PanelDialogo({
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'auto',
  size = 'md',
  ariaLabel,
  initialFocus,
  closeOnOverlay = true,
  showClose = true,
  className,
  bodyClassName,
}: ModalProps) {
  const id = useId()
  const tituloId = `${id}-titulo`
  const descId = `${id}-desc`
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dragControls = useDragControls()
  const movil = useMedia('(max-width: 639px)')
  const escritorio = useMedia('(min-width: 1024px)')
  const tipo: Exclude<ModalVariant, 'auto'> =
    variant === 'auto'
      ? movil
        ? 'sheet'
        : 'modal'
      : variant === 'drawer'
        ? escritorio
          ? 'drawer'
          : 'sheet'
        : variant

  // onClose estable para los listeners globales.
  const cerrarRef = useRef(onClose)
  useEffect(() => {
    cerrarRef.current = onClose
  }, [onClose])

  // Foco inicial, bloqueo de scroll y devolución del foco.
  useEffect(() => {
    const previo =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const liberar = bloquearScroll()
    pila.push(id)
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current
      const destino =
        initialFocus?.current ??
        panel?.querySelector<HTMLElement>('[data-autofocus]') ??
        panel
      destino?.focus({ preventScroll: true })
    })
    return () => {
      cancelAnimationFrame(frame)
      liberar()
      const i = pila.lastIndexOf(id)
      if (i >= 0) pila.splice(i, 1)
      if (previo && document.contains(previo)) {
        previo.focus({ preventScroll: true })
      }
    }
  }, [id, initialFocus])

  // Si el foco se escapa del diálogo de arriba, vuelve a él. Esc también
  // cierra cuando el foco quedó fuera del panel (p. ej. en <body>); dentro del
  // panel lo gestiona su onKeyDown (y un menú anidado puede consumirlo antes).
  useEffect(() => {
    const esElDeArriba = () => pila[pila.length - 1] === id
    const onFocusIn = (e: FocusEvent) => {
      if (!esElDeArriba()) return
      const panel = panelRef.current
      if (panel && e.target instanceof Node && !panel.contains(e.target)) {
        panel.focus({ preventScroll: true })
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !esElDeArriba()) return
      const panel = panelRef.current
      if (panel && e.target instanceof Node && panel.contains(e.target)) return
      cerrarRef.current()
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [id])

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      cerrarRef.current()
      return
    }
    if (e.key !== 'Tab') return
    e.stopPropagation()
    const panel = panelRef.current
    if (!panel) return
    const items = Array.from(
      panel.querySelectorAll<HTMLElement>(ENFOCABLES)
    ).filter((el) => el.getClientRects().length > 0)
    const primero = items[0]
    const ultimo = items[items.length - 1]
    if (!primero || !ultimo) {
      e.preventDefault()
      panel.focus()
      return
    }
    const activo = document.activeElement
    if (e.shiftKey && (activo === primero || activo === panel)) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && activo === ultimo) {
      e.preventDefault()
      primero.focus()
    }
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const alto = panelRef.current?.offsetHeight ?? 1
    if (info.offset.y > alto * 0.3 || info.velocity.y > 500) {
      cerrarRef.current()
    }
  }

  const movimiento =
    tipo === 'modal'
      ? {
          initial: { opacity: 0, scale: 0.97 },
          animate: {
            opacity: 1,
            scale: 1,
            transition: { duration: 0.22, ease: EASE.papel },
          },
          exit: {
            opacity: 0,
            scale: 0.97,
            transition: { duration: 0.16, ease: EASE.salida },
          },
        }
      : tipo === 'sheet'
        ? {
            initial: { y: '100%' },
            animate: {
              y: 0,
              transition: { duration: 0.38, ease: EASE.papel },
            },
            exit: {
              y: '100%',
              transition: { duration: 0.24, ease: EASE.salida },
            },
          }
        : {
            initial: { x: '100%' },
            animate: {
              x: 0,
              transition: { duration: 0.38, ease: EASE.papel },
            },
            exit: {
              x: '100%',
              transition: { duration: 0.24, ease: EASE.salida },
            },
          }

  const iniciarArrastre = (e: ReactPointerEvent) => {
    if (tipo === 'sheet') dragControls.start(e)
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-(--z-modal) flex',
        tipo === 'modal' && 'items-center justify-center p-4',
        tipo === 'sheet' && 'items-end',
        tipo === 'drawer' && 'justify-end'
      )}
    >
      <m.div
        aria-hidden="true"
        className="absolute inset-0 bg-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: DUR.base } }}
        exit={{ opacity: 0, transition: { duration: 0.16 } }}
        // Pulsar el velo no saca el foco del diálogo (Esc y Tab siguen dentro).
        onMouseDown={(e) => e.preventDefault()}
        onClick={closeOnOverlay ? () => cerrarRef.current() : undefined}
      />
      <m.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? tituloId : undefined}
        aria-label={title ? undefined : ariaLabel}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        {...movimiento}
        drag={tipo === 'sheet' ? 'y' : false}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 1 }}
        onDragEnd={onDragEnd}
        className={cn(
          'relative flex flex-col bg-surface-raised text-fg shadow-float focus-visible:outline-none',
          tipo === 'modal' &&
            'max-h-[min(90dvh,880px)] rounded-sheet p-7 dark:border dark:border-border',
          tipo === 'modal' &&
            (size === 'lg'
              ? 'w-[min(720px,calc(100vw-32px))]'
              : 'w-[min(560px,calc(100vw-32px))]'),
          tipo === 'sheet' &&
            'max-h-[90dvh] w-full rounded-t-sheet px-5 pb-[max(16px,env(safe-area-inset-bottom))] dark:border-t dark:border-border',
          tipo === 'drawer' &&
            'h-dvh w-[420px] max-w-full rounded-l-sheet p-6 dark:border-l dark:border-border',
          className
        )}
      >
        {tipo === 'sheet' ? (
          <div
            aria-hidden="true"
            onPointerDown={iniciarArrastre}
            className="-mx-5 flex shrink-0 cursor-grab touch-none justify-center pt-2 pb-3 active:cursor-grabbing"
          >
            <span className="h-1 w-9 rounded-full bg-rule" />
          </div>
        ) : null}
        {title || showClose ? (
          <div
            onPointerDown={iniciarArrastre}
            className={cn(
              'flex shrink-0 items-start justify-between gap-4',
              tipo === 'sheet' && 'touch-none'
            )}
          >
            {title ? (
              <h2 id={tituloId} className="pt-1.5 font-display text-h3 text-fg">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {showClose ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar"
                className="-mt-1.5 -mr-2.5 shrink-0"
                onClick={() => cerrarRef.current()}
                icon={<X strokeWidth={1.75} />}
              />
            ) : null}
          </div>
        ) : null}
        {description ? (
          <div id={descId} className="mt-1 shrink-0 text-body-s text-fg-muted">
            {description}
          </div>
        ) : null}
        {children ? (
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto',
              title || description ? 'mt-5' : undefined,
              bodyClassName
            )}
          >
            {children}
          </div>
        ) : null}
        {footer ? (
          <div className="mt-6 flex shrink-0 flex-wrap justify-end gap-3">
            {footer}
          </div>
        ) : null}
      </m.div>
    </div>
  )
}

/** Hoja inferior (siempre sheet). */
export function Sheet(props: Omit<ModalProps, 'variant'>) {
  return <Modal {...props} variant="sheet" />
}

/** Panel derecho de 420 px desde 1024 (sheet por debajo): «Ajustar con IA». */
export function Drawer(props: Omit<ModalProps, 'variant'>) {
  return <Modal {...props} variant="drawer" />
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  /** Si devuelve una promesa, muestra el spinner hasta que termine. Si se
   * resuelve, el diálogo se cierra; si lanza, se queda abierto. */
  onConfirm: () => void | Promise<unknown>
  /** En forma de pregunta: «¿Eliminar este viaje?». */
  title: string
  /** Consecuencia en text-fg-muted. */
  description?: ReactNode
  /** Verbo exacto: «Eliminar viaje». */
  confirmLabel: string
  /** Etiqueta en gerundio mientras confirma: «Eliminando…». */
  loadingLabel?: string
  cancelLabel?: string
  /** danger (por defecto) usa el único botón danger permitido; neutral, tinta. */
  tone?: 'danger' | 'neutral'
  /** Texto que hay que escribir para confirmar (email o nombre). */
  confirmText?: string
  /** Etiqueta del campo de confirmación. */
  confirmTextLabel?: ReactNode
  /** Fuerza el estado de carga desde fuera. */
  loading?: boolean
  /** Cierra al confirmar (por defecto, sí). */
  closeOnConfirm?: boolean
}

/** Sustituye a window.confirm (docs/DISENO.md §5.6). */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  ...resto
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      variant="modal"
    >
      <ContenidoConfirmacion onClose={onClose} {...resto} />
    </Modal>
  )
}

function ContenidoConfirmacion({
  onClose,
  onConfirm,
  confirmLabel,
  loadingLabel,
  cancelLabel = 'Cancelar',
  tone = 'danger',
  confirmText,
  confirmTextLabel,
  loading = false,
  closeOnConfirm = true,
}: Omit<ConfirmDialogProps, 'open' | 'title' | 'description'>) {
  const id = useId()
  const [escrito, setEscrito] = useState('')
  const [enviando, setEnviando] = useState(false)
  const ocupado = loading || enviando
  const coincide = !confirmText || escrito.trim() === confirmText.trim()

  const confirmar = async () => {
    if (!coincide || ocupado) return
    try {
      const r = onConfirm()
      if (r instanceof Promise) {
        setEnviando(true)
        await r
      }
      if (closeOnConfirm) onClose()
    } catch {
      // El llamador muestra el error (toast); el diálogo sigue abierto.
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void confirmar()
      }}
    >
      {confirmText ? (
        <div className="flex flex-col">
          <label
            htmlFor={`${id}-confirmar`}
            className="mb-1.5 block text-label text-fg"
          >
            {confirmTextLabel ?? (
              <>
                Escribe <span className="font-mono">{confirmText}</span> para
                confirmar
              </>
            )}
          </label>
          <input
            id={`${id}-confirmar`}
            data-autofocus
            autoComplete="off"
            spellCheck={false}
            value={escrito}
            onChange={(e) => setEscrito(e.target.value)}
            className="h-control-md w-full rounded-control border border-border-strong bg-surface px-3.5 font-mono text-base text-fg hover:border-fg-muted focus-visible:outline-none focus:border-ring focus:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)]"
          />
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={ocupado}
          data-autofocus={confirmText ? undefined : true}
        >
          {cancelLabel}
        </Button>
        <Button
          type="submit"
          variant={tone === 'danger' ? 'danger' : 'tinta'}
          loading={ocupado}
          {...(loadingLabel ? { loadingText: loadingLabel } : {})}
          disabled={!coincide}
        >
          {confirmLabel}
        </Button>
      </div>
    </form>
  )
}
