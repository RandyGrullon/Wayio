'use client'

import type { ReactNode } from 'react'
import { LazyMotion, MotionConfig } from 'framer-motion'

/**
 * Infraestructura de movimiento (docs/DISENO.md §7.2).
 *
 * - LazyMotion con domMax en un chunk asíncrono (layout, layoutId y drag).
 *   `strict`: dentro de la app se usa `m.*`, nunca `motion.*`.
 * - MotionConfig reducedMotion="user": con movimiento reducido se anulan
 *   traslaciones y escalas y se conservan los fundidos.
 * - Transición por defecto: 280 ms con ease-papel.
 */
const loadFeatures = () =>
  import('./motion-features').then((modulo) => modulo.default)

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig
        reducedMotion="user"
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}

export default MotionProvider
