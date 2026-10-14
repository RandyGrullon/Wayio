'use client'

import { useEffect, useId, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils/cn'

interface CopiarEnlaceProps {
  url: string
  /** Etiqueta visible del campo. */
  etiqueta: string
  /** Texto de apoyo bajo el campo. */
  ayuda?: string
  /** Mensaje del toast al copiar. */
  mensajeCopiado?: string
  onCopiado?: () => void
  className?: string
}

/**
 * Enlace con «Copiar» (Copy → Check en 140 ms y toast «Enlace copiado»,
 * docs/DISENO.md §7.4). Si el portapapeles falla, selecciona el texto.
 */
export function CopiarEnlace({
  url,
  etiqueta,
  ayuda,
  mensajeCopiado = 'Enlace copiado',
  onCopiado,
  className,
}: CopiarEnlaceProps) {
  const id = useId()
  const { success, error } = useToast()
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!copiado) return
    const t = window.setTimeout(() => setCopiado(false), 2000)
    return () => window.clearTimeout(t)
  }, [copiado])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      success(mensajeCopiado)
      onCopiado?.()
    } catch {
      const campo = document.getElementById(id)
      if (campo instanceof HTMLInputElement) campo.select()
      error('No pudimos copiar. Selecciona el enlace y cópialo a mano.')
    }
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <label htmlFor={id} className="mb-1.5 text-label text-fg">
        {etiqueta}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-control-md min-w-0 flex-1 rounded-control border border-border-strong bg-surface px-3.5 font-mono text-[14px] text-fg focus-visible:outline-none focus:border-ring focus:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)]"
          aria-describedby={ayuda ? `${id}-ayuda` : undefined}
        />
        <Button
          variant="outline"
          onClick={() => void copiar()}
          aria-label={
            copiado ? 'Enlace copiado' : `Copiar ${etiqueta.toLowerCase()}`
          }
          className="shrink-0"
          icon={
            <span className="relative inline-grid size-[18px] place-items-center">
              <AnimatePresence initial={false} mode="popLayout">
                {copiado ? (
                  <m.span
                    key="ok"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.14 }}
                    className="inline-flex"
                  >
                    <Check />
                  </m.span>
                ) : (
                  <m.span
                    key="copiar"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.14 }}
                    className="inline-flex"
                  >
                    <Copy />
                  </m.span>
                )}
              </AnimatePresence>
            </span>
          }
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      {ayuda ? (
        <p id={`${id}-ayuda`} className="mt-1.5 text-caption text-fg-muted">
          {ayuda}
        </p>
      ) : null}
    </div>
  )
}
