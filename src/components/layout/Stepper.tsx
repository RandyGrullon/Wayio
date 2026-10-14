'use client'

import Link from 'next/link'
import { m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { EASE } from '@/components/ui/motion'

/**
 * Stepper de ruta del header del flujo (docs/DISENO.md §5.15): 4 estaciones
 * unidas por tramos. Pendiente = aro border-strong; actual = aro primary con
 * punto (aria-current="step"); hecha = relleno fg (y enlace para volver).
 * El tramo hecho se traza con scaleX 0→1 en 420 ms (ease-tinta).
 */

export const PASOS_RUTA = [
  { id: 'datos', label: 'Tu viaje' },
  { id: 'trazado', label: 'Trazado' },
  { id: 'versiones', label: 'Versiones' },
  { id: 'itinerario', label: 'Itinerario' },
] as const

export type PasoRuta = (typeof PASOS_RUTA)[number]['id']

export interface StepperRutaProps {
  paso: PasoRuta
  /** Enlaces para volver a las estaciones hechas (por paso). */
  hrefs?: Partial<Record<PasoRuta, string>> | undefined
  className?: string
}

export function indicePaso(paso: PasoRuta): number {
  return Math.max(
    0,
    PASOS_RUTA.findIndex((p) => p.id === paso)
  )
}

export function StepperRuta({ paso, hrefs, className }: StepperRutaProps) {
  const actual = indicePaso(paso)
  return (
    <nav aria-label="Progreso del viaje" className={className}>
      <ol className="flex items-center">
        {PASOS_RUTA.map((p, i) => {
          const hecho = i < actual
          const esActual = i === actual
          const href = hecho ? hrefs?.[p.id] : undefined
          const estado = hecho
            ? '(completado)'
            : esActual
              ? '(paso actual)'
              : '(pendiente)'
          const estacion = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  'relative grid size-2.5 shrink-0 place-items-center rounded-full',
                  hecho && 'bg-fg',
                  esActual && 'border-2 border-primary',
                  !hecho && !esActual && 'border-2 border-border-strong'
                )}
              >
                {esActual ? (
                  <span className="size-[3px] rounded-full bg-primary" />
                ) : null}
              </span>
              <span
                className={cn(
                  'text-[13px] whitespace-nowrap',
                  esActual ? 'font-semibold text-fg' : 'text-fg-subtle'
                )}
              >
                {p.label}
                <span className="sr-only"> {estado}</span>
              </span>
            </>
          )
          return (
            <li key={p.id} className="flex items-center">
              {i > 0 ? (
                <span
                  aria-hidden="true"
                  className="relative mx-2.5 block h-0.5 w-6 shrink-0"
                >
                  <span className="absolute inset-0 border-t-2 border-dotted border-rule" />
                  {i <= actual ? (
                    <m.span
                      className="absolute inset-0 origin-left bg-fg"
                      // Solo se traza el tramo recién completado.
                      initial={i === actual ? { scaleX: 0 } : false}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.42, ease: EASE.tinta }}
                    />
                  ) : null}
                </span>
              ) : null}
              {href ? (
                <Link
                  href={href}
                  className="inline-flex items-center gap-2 rounded-sm hover:[&>span:last-child]:text-fg"
                >
                  {estacion}
                </Link>
              ) : (
                <span
                  aria-current={esActual ? 'step' : undefined}
                  className="inline-flex items-center gap-2"
                >
                  {estacion}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Versión compacta para móvil: «2 de 4 · Trazado». */
export function StepperRutaCompacto({
  paso,
  className,
}: {
  paso: PasoRuta
  className?: string
}) {
  const actual = indicePaso(paso)
  const etiqueta = PASOS_RUTA[actual]?.label ?? ''
  return (
    <p
      aria-label={`Paso ${actual + 1} de ${PASOS_RUTA.length}: ${etiqueta}`}
      className={cn(
        'text-[13px] whitespace-nowrap text-fg-subtle tnum',
        className
      )}
    >
      {actual + 1} de {PASOS_RUTA.length} ·{' '}
      <span className="font-semibold text-fg">{etiqueta}</span>
    </p>
  )
}

/** Fracción de avance (0–1) del paso, para la barra de 2 px móvil. */
export function avancePaso(paso: PasoRuta): number {
  return (indicePaso(paso) + 1) / PASOS_RUTA.length
}
