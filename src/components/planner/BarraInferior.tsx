'use client'

import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useIsPresent } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

/**
 * Barra fija inferior del flujo (h-bottombar, bg-surface/95, filete
 * superior). Se monta en <body> con un portal: los pasos se deslizan con
 * transform y un ancestro transformado rompería el `position: fixed`.
 * El flujo solo se monta en el cliente, así que document existe.
 *
 * Mientras su paso sale (AnimatePresence), la barra ya no se pinta: el portal
 * no hereda la animación de salida y se solaparía con la del paso nuevo.
 */
export function BarraInferior({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const presente = useIsPresent()
  if (!presente) return null
  return createPortal(
    <div
      data-print="hide"
      className={cn(
        'fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)]',
        className
      )}
    >
      <div className="mx-auto flex h-bottombar max-w-content items-center justify-between gap-3 px-4 md:px-6 lg:px-8">
        {children}
      </div>
    </div>,
    document.body
  )
}
