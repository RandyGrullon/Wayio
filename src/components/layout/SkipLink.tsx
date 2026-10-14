'use client'

import type { MouseEvent } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * «Saltar al contenido» (docs/DISENO.md §5.11): primer elemento enfocable.
 * Va a #contenido; si la página no lo define, enfoca el primer <main> o <h1>.
 */
export function SkipLink({
  targetId = 'contenido',
  className,
}: {
  targetId?: string
  className?: string
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const destino =
      document.getElementById(targetId) ??
      document.querySelector<HTMLElement>('main') ??
      document.querySelector<HTMLElement>('h1')
    if (!destino) return
    e.preventDefault()
    if (!destino.hasAttribute('tabindex'))
      destino.setAttribute('tabindex', '-1')
    destino.focus({ preventScroll: true })
    destino.scrollIntoView({ block: 'start' })
  }
  return (
    <a
      href={`#${targetId}`}
      onClick={onClick}
      className={cn(
        'sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-4 focus:z-(--z-tooltip) focus:inline-flex focus:h-10 focus:items-center focus:rounded-full focus:bg-surface-inverse focus:px-4 focus:text-[14px] focus:font-semibold focus:text-fg-inverse focus:shadow-float focus-visible:outline-ring',
        className
      )}
    >
      Saltar al contenido
    </a>
  )
}
