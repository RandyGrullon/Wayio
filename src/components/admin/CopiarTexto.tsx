'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Check, Copy } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils/cn'

/**
 * ID o clave en Geist Mono 13 px con botón copiar de 32 px (área de 44)
 * (docs/DISENO.md §5.13). Copy → Check en 140 ms y toast de confirmación.
 * Lleva `relative z-10`: queda por encima del enlace de la fila.
 */
export function CopiarTexto({
  valor,
  mostrar,
  etiqueta = 'Copiar ID',
  aviso = 'ID copiado',
  className,
}: {
  valor: string
  /** Texto visible (p. ej. el id recortado). Por defecto, el valor. */
  mostrar?: string
  etiqueta?: string
  aviso?: string
  className?: string
}) {
  const { success, error } = useToast()
  const [copiado, setCopiado] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    []
  )

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(true)
      success(aviso)
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopiado(false), 1600)
    } catch {
      error('No se pudo copiar', {
        description: 'Tu navegador no dio permiso para usar el portapapeles.',
      })
    }
  }

  return (
    <span
      className={cn(
        'relative z-10 inline-flex min-w-0 items-center gap-0.5',
        className
      )}
    >
      <code
        className="min-w-0 truncate font-mono text-[13px] text-fg-muted"
        title={valor}
      >
        {mostrar ?? valor}
      </code>
      <button
        type="button"
        onClick={copiar}
        aria-label={etiqueta}
        title={etiqueta}
        className="relative inline-grid size-8 shrink-0 place-items-center rounded-full text-fg-subtle transition-colors duration-(--dur-fast) after:absolute after:-inset-1.5 hover:bg-surface-2 hover:text-fg"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <m.span
            key={copiado ? 'ok' : 'copiar'}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.14 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="inline-flex"
          >
            {copiado ? (
              <Check strokeWidth={2} className="size-4 text-success" />
            ) : (
              <Copy strokeWidth={1.75} className="size-4" />
            )}
          </m.span>
        </AnimatePresence>
      </button>
    </span>
  )
}
