'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { EASE } from './motion'

/**
 * Toasts (docs/DISENO.md §5.8): tinta invertida, abajo al centro en móvil y
 * abajo a la derecha en desktop. 5 s (8 s con acción), pausa con hover o
 * foco, máximo 3 apilados. role="status" (errores, role="alert").
 *
 * Para separarlo de una barra inferior fija o de un FAB, la pantalla llama a
 * useToastOffset(px, media?) mientras está montada (no se escribe
 * `--wy-toast-offset` a mano: el registro decide el valor final).
 */

// ─── Separación sobre barras inferiores ────────────────────────────────────

interface RegistroOffset {
  px: number
  /** Solo cuenta mientras la consulta coincide (null = siempre). */
  mq: MediaQueryList | null
}

/**
 * Pantallas montadas que piden separación. Cada montaje es una entrada propia
 * (cuenta de referencias): en el relevo entre pasos la pantalla que sale se
 * desmonta DESPUÉS de montarse la nueva y no puede borrar su valor.
 */
const registroOffsets = new Set<RegistroOffset>()

/** Escribe en <html> la mayor separación activa (o la quita si no hay). */
function aplicarOffset(): void {
  if (typeof document === 'undefined') return
  let max = 0
  for (const r of registroOffsets) {
    if (!r.mq || r.mq.matches) max = Math.max(max, r.px)
  }
  const raiz = document.documentElement
  if (max > 0) raiz.style.setProperty('--wy-toast-offset', `${max}px`)
  else raiz.style.removeProperty('--wy-toast-offset')
}

/**
 * Sube los toasts `px` píxeles (p. ej. 72 = h-bottombar) mientras el
 * componente está montado, en todos los anchos o solo cuando `media`
 * coincide (p. ej. '(max-width: 1023px)' para una barra solo móvil).
 * Con varias pantallas a la vez se aplica la mayor.
 */
export function useToastOffset(px: number, media?: string): void {
  useEffect(() => {
    const mq = media ? window.matchMedia(media) : null
    const registro: RegistroOffset = { px: Math.max(0, px), mq }
    registroOffsets.add(registro)
    mq?.addEventListener('change', aplicarOffset)
    aplicarOffset()
    return () => {
      mq?.removeEventListener('change', aplicarOffset)
      registroOffsets.delete(registro)
      aplicarOffset()
    }
  }, [px, media])
}

export type ToastTone = 'neutral' | 'success' | 'danger'

export interface ToastAction {
  /** «Deshacer», «Ver», «Reintentar». */
  label: string
  onClick: () => void
}

export interface ToastOptions {
  message: string
  description?: string
  tone?: ToastTone
  action?: ToastAction
  /** ms; por defecto 5000 (8000 con acción). */
  duration?: number
}

interface ToastItem extends ToastOptions {
  id: string
}

export interface ToastApi {
  toast: (opciones: ToastOptions) => string
  success: (
    message: string,
    opciones?: Omit<ToastOptions, 'message' | 'tone'>
  ) => string
  error: (
    message: string,
    opciones?: Omit<ToastOptions, 'message' | 'tone'>
  ) => string
  dismiss: (id: string) => void
}

const MAXIMO = 3

const noop: ToastApi = {
  toast: () => '',
  success: () => '',
  error: () => '',
  dismiss: () => {},
}

const Contexto = createContext<ToastApi>(noop)

/** API de toasts. Fuera de ToastProvider no hace nada (nunca rompe). */
export function useToast(): ToastApi {
  return useContext(Contexto)
}

let contador = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((opciones: ToastOptions) => {
    contador += 1
    const id = `wy-toast-${contador}`
    setItems((prev) => [...prev, { ...opciones, id }].slice(-MAXIMO))
    return id
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      dismiss,
      success: (message, opciones = {}) =>
        toast({ ...opciones, message, tone: 'success' }),
      error: (message, opciones = {}) =>
        toast({ ...opciones, message, tone: 'danger' }),
    }),
    [toast, dismiss]
  )

  return (
    <Contexto.Provider value={api}>
      {children}
      {/* Región viva persistente (sin aria-label: está prohibido en un div
          genérico y un landmark vacío solo sería ruido). La separación
          (useToastOffset) se respeta en todos los anchos: en desktop el FAB
          «Ajustar con IA» ocupa la misma esquina (right-6 bottom-6). */}
      <div
        aria-live="polite"
        className={cn(
          'pointer-events-none fixed inset-x-4 z-(--z-toast) flex flex-col items-center gap-2',
          'bottom-[calc(16px+env(safe-area-inset-bottom)+var(--wy-toast-offset,0px))]',
          'md:right-6 md:bottom-[calc(24px+env(safe-area-inset-bottom)+var(--wy-toast-offset,0px))] md:left-auto md:w-[400px] md:items-end'
        )}
        data-print="hide"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <ToastVista key={t.id} item={t} onClose={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </Contexto.Provider>
  )
}

function ToastVista({
  item,
  onClose,
}: {
  item: ToastItem
  onClose: () => void
}) {
  const { message, description, tone = 'neutral', action, duration } = item
  const total = duration ?? (action ? 8000 : 5000)
  const restante = useRef(total)
  const inicio = useRef(0)
  const timer = useRef<number | null>(null)
  const cerrarRef = useRef(onClose)
  useEffect(() => {
    cerrarRef.current = onClose
  }, [onClose])

  const pausar = useCallback(() => {
    if (timer.current === null) return
    window.clearTimeout(timer.current)
    timer.current = null
    restante.current -= Date.now() - inicio.current
  }, [])

  const reanudar = useCallback(() => {
    if (timer.current !== null) return
    inicio.current = Date.now()
    timer.current = window.setTimeout(
      () => cerrarRef.current(),
      Math.max(800, restante.current)
    )
  }, [])

  useEffect(() => {
    reanudar()
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [reanudar])

  const Icono =
    tone === 'success' ? CheckCircle2 : tone === 'danger' ? AlertCircle : null

  return (
    <m.div
      layout
      role={tone === 'danger' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: 0.22, ease: EASE.papel },
      }}
      exit={{
        opacity: 0,
        y: 8,
        transition: { duration: 0.16, ease: EASE.salida },
      }}
      onPointerEnter={pausar}
      onPointerLeave={reanudar}
      onFocusCapture={pausar}
      onBlurCapture={reanudar}
      className="pointer-events-auto flex w-full max-w-[400px] items-start gap-3 rounded-control bg-surface-inverse px-4 py-3 text-[14px] font-medium text-fg-inverse shadow-float [&_:focus-visible]:outline-ring-inverse"
    >
      {Icono ? (
        <Icono
          aria-hidden="true"
          strokeWidth={1.75}
          className={cn(
            'mt-px size-[18px] shrink-0',
            tone === 'success' ? 'text-toast-success' : 'text-toast-danger'
          )}
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p>{message}</p>
        {description ? (
          <p className="mt-0.5 font-normal opacity-80">{description}</p>
        ) : null}
      </div>
      {action ? (
        <button
          type="button"
          onClick={() => {
            action.onClick()
            onClose()
          }}
          className="shrink-0 rounded-sm font-semibold text-toast-action underline-offset-2 hover:underline"
        >
          {action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={onClose}
        className="-my-1 -mr-1.5 inline-grid size-7 shrink-0 place-items-center rounded-full opacity-70 transition-opacity hover:opacity-100"
      >
        <X aria-hidden="true" strokeWidth={1.75} className="size-4" />
      </button>
    </m.div>
  )
}
