'use client'

import { useEffect, useRef, useState } from 'react'
import { prefiereMenosMovimiento } from '@/components/map/useTemaMapa'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'

/**
 * Interpola un número hacia su nuevo valor en 400 ms (contadores de dinero,
 * docs/DISENO.md §7.4). Con movimiento reducido salta al valor final.
 */
export function useNumeroAnimado(valor: number, duracionMs = 400): number {
  const [mostrado, setMostrado] = useState(valor)
  const actualRef = useRef(valor)

  useEffect(() => {
    const desde = actualRef.current
    if (desde === valor) return
    const reducir = prefiereMenosMovimiento()
    const inicio = performance.now()
    let frame = 0
    const paso = (t: number) => {
      const p = reducir ? 1 : Math.min(1, (t - inicio) / duracionMs)
      const suave = 1 - Math.pow(1 - p, 3)
      const v = p >= 1 ? valor : desde + (valor - desde) * suave
      actualRef.current = v
      setMostrado(v)
      if (p < 1) frame = requestAnimationFrame(paso)
    }
    frame = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(frame)
  }, [valor, duracionMs])

  return mostrado
}

/**
 * Importe en la moneda del viaje con interpolación visual. Los lectores de
 * pantalla leen solo el valor final (el número animado va aria-hidden).
 */
export function Dinero({
  valor,
  moneda,
  className,
}: {
  valor: number
  moneda: string
  className?: string
}) {
  const animado = useNumeroAnimado(valor)
  return (
    <span className={cn('tnum', className)}>
      <span aria-hidden="true">
        {formatCurrency(Math.round(animado), moneda)}
      </span>
      <span className="sr-only">{formatCurrency(valor, moneda)}</span>
    </span>
  )
}
