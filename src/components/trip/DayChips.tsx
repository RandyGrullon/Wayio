'use client'

import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Day, Trip } from '@/types/trip'
import { diaClases } from '@/constants/mapColors'
import { formatDiaCorto } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { prefiereMenosMovimiento } from '@/components/map/useTemaMapa'
import { fechaDelDia } from './tripUtils'

/**
 * Día visible según el scroll (IntersectionObserver sobre los capítulos con
 * `data-dia-capitulo`). null = ningún capítulo en la franja central (portada
 * o anexos a la vista).
 */
export function useDiaVisible(
  contenedor: RefObject<HTMLElement | null>,
  dependencia: unknown
): number | null {
  const [visible, setVisible] = useState<number | null>(null)

  useEffect(() => {
    const raiz = contenedor.current
    if (!raiz || typeof IntersectionObserver === 'undefined') return
    const secciones = Array.from(
      raiz.querySelectorAll<HTMLElement>('[data-dia-capitulo]')
    )
    const dentro = new Set<number>()
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          const i = Number(e.target.getAttribute('data-dia-capitulo'))
          if (!Number.isFinite(i)) continue
          if (e.isIntersecting) dentro.add(i)
          else dentro.delete(i)
        }
        setVisible(dentro.size > 0 ? Math.min(...dentro) : null)
      },
      { rootMargin: '-35% 0px -55% 0px' }
    )
    secciones.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [contenedor, dependencia])

  return visible
}

interface DayChipsProps {
  dias: Day[]
  trip: Pick<Trip, 'fechaInicio'>
  /** Día activo (0 = día 1) o null = «Todo». */
  activo: number | null
  /** Se eligió un chip (el padre mueve el mapa). */
  onElegir: (dia: number | null) => void
  /** Prefijo de los ids de los capítulos. */
  idPrefijo?: string
  /** Id del ancla de «Todo» (inicio del itinerario). */
  idInicio: string
  className?: string
}

/**
 * Chips de día sticky (docs/DISENO.md §5.7 y §6.5): «Todo» + «01 sáb 12».
 * Seleccionado = tinta; el punto conserva el color del día. Son enlaces a los
 * capítulos (aria-current marca el día a la vista).
 */
export function DayChips({
  dias,
  trip,
  activo,
  onElegir,
  idPrefijo = 'dia',
  idInicio,
  className,
}: DayChipsProps) {
  const listaRef = useRef<HTMLUListElement | null>(null)

  // Mantiene a la vista el chip activo (desplazamiento horizontal).
  useEffect(() => {
    const lista = listaRef.current
    if (!lista) return
    const chip = lista.querySelector<HTMLElement>('[aria-current="true"]')
    if (!chip) return
    const izq = chip.offsetLeft - 16
    const der = chip.offsetLeft + chip.offsetWidth + 16
    if (izq < lista.scrollLeft || der > lista.scrollLeft + lista.clientWidth) {
      lista.scrollTo({
        left: Math.max(0, izq),
        behavior: prefiereMenosMovimiento() ? 'auto' : 'smooth',
      })
    }
  }, [activo])

  const ir = (id: string, dia: number | null) => {
    onElegir(dia)
    const destino = document.getElementById(id)
    if (!destino) return
    destino.scrollIntoView({
      behavior: prefiereMenosMovimiento() ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  const base =
    'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[14px] font-semibold whitespace-nowrap tnum transition-colors duration-(--dur-fast) ease-papel pointer-coarse:h-11'

  return (
    <nav
      aria-label="Días del viaje"
      data-print="hide"
      className={cn(
        'sticky top-14 z-(--z-sticky) -mx-4 bg-bg/92 px-4 py-2 backdrop-blur-header md:top-16 md:-mx-0 md:px-0',
        className
      )}
    >
      <ul
        ref={listaRef}
        className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <li>
          <a
            href={`#${idInicio}`}
            aria-current={activo === null ? 'true' : undefined}
            onClick={(e) => {
              e.preventDefault()
              ir(idInicio, null)
            }}
            className={cn(
              base,
              activo === null
                ? 'border-surface-inverse bg-surface-inverse text-fg-inverse'
                : 'border-border-strong bg-surface text-fg hover:bg-surface-2'
            )}
          >
            Todo
          </a>
        </li>
        {dias.map((dia, i) => {
          const fecha = fechaDelDia(trip, i)
          const sel = activo === i
          return (
            <li key={`${dia.numero}-${i}`}>
              <a
                href={`#${idPrefijo}-${i + 1}`}
                aria-current={sel ? 'true' : undefined}
                aria-label={`Día ${i + 1}${fecha ? `, ${formatDiaCorto(fecha)}` : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  ir(`${idPrefijo}-${i + 1}`, i)
                }}
                className={cn(
                  base,
                  sel
                    ? 'border-surface-inverse bg-surface-inverse text-fg-inverse'
                    : 'border-border-strong bg-surface text-fg hover:bg-surface-2'
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn('size-2 rounded-full', diaClases(i).bg)}
                />
                <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                {fecha ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'font-medium',
                      sel ? 'text-fg-inverse/80' : 'text-fg-subtle'
                    )}
                  >
                    {formatDiaCorto(fecha)}
                  </span>
                ) : null}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
