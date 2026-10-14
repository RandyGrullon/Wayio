'use client'

import { m } from 'framer-motion'
import { EASE } from '@/components/ui/motion'
import { cn } from '@/lib/utils/cn'

/**
 * Línea de «Cómo funciona» (docs/DISENO.md §6.1): se traza UNA vez al entrar
 * en la vista (sin bucles). Horizontal desde md y vertical por debajo; con
 * movimiento reducido aparece ya trazada.
 */
export function TrazoEnVista({
  orientacion,
  className,
}: {
  orientacion: 'horizontal' | 'vertical'
  className?: string
}) {
  const horizontal = orientacion === 'horizontal'
  return (
    <m.span
      aria-hidden="true"
      className={cn(
        'absolute block rounded-full bg-fg',
        horizontal ? 'h-0.5 origin-left' : 'w-0.5 origin-top',
        className
      )}
      initial={horizontal ? { scaleX: 0 } : { scaleY: 0 }}
      whileInView={horizontal ? { scaleX: 1 } : { scaleY: 1 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 1.1, ease: EASE.tinta }}
    />
  )
}
