'use client'

import type { ReactNode } from 'react'
import { m } from 'framer-motion'
import { Check, CloudSun, Compass, Flag, MapPin, X } from 'lucide-react'
import { EASE } from '@/components/ui/motion'
import type { ProgressEvent } from '@/lib/ai/generateTrips'
import { cn } from '@/lib/utils/cn'

/**
 * RutaDeFases (docs/DISENO.md §6.3 y §7.3): sustituye a Loader3D. Cuatro
 * sellos de 40 px unidos por tramos, horizontal desde 640 px y vertical por
 * debajo. Todo sale de la fase REAL del SSE (no hay temporizadores):
 * pendiente = aro border-strong · activo = aro primary con punto · hecho =
 * relleno fg con Check · error = danger con X. Los tramos hechos son sólidos
 * en fg; el tramo en curso, punteado primary con animate-hormigas.
 */

export const SELLOS: readonly {
  id: 'contexto' | 'itinerario' | 'coords' | 'listo'
  texto: string
  icono: ReactNode
}[] = [
  { id: 'contexto', texto: 'Clima y ubicación', icono: <CloudSun /> },
  { id: 'itinerario', texto: 'La IA arma 3 versiones', icono: <Compass /> },
  { id: 'coords', texto: 'Ubicando lugares', icono: <MapPin /> },
  { id: 'listo', texto: 'Listo', icono: <Flag /> },
]

/** Fase del SSE → índice del sello (−1 si no avanza la ruta). */
export function indiceDeFase(fase: ProgressEvent['fase']): number {
  switch (fase) {
    case 'contexto':
      return 0
    case 'plan':
    case 'ia':
    case 'dias':
      return 1
    case 'coords':
      return 2
    case 'listo':
    case 'cache':
    case 'demo':
      return 3
    default:
      return -1
  }
}

type EstadoSello = 'pendiente' | 'activo' | 'hecho' | 'error'

export interface RutaDeFasesProps {
  /** Índice del sello en curso (0..3). */
  actual: number
  /** Todos los sellos completos (fase listo, caché o demo). */
  completo: boolean
  error?: boolean
  /** Caché o demo: la ruta completa se traza en 600 ms. */
  rapido?: boolean
  /** layoutId del aro de origen (relevo del CTA del formulario). */
  origenLayoutId?: string
  className?: string
}

export function RutaDeFases({
  actual,
  completo,
  error = false,
  rapido = false,
  origenLayoutId,
  className,
}: RutaDeFasesProps) {
  const estadoDe = (i: number): EstadoSello =>
    completo || i < actual
      ? 'hecho'
      : i === actual
        ? error
          ? 'error'
          : 'activo'
        : 'pendiente'
  // Con caché/demo cada sello se sella 150 ms después del anterior.
  const retardo = (i: number) => (rapido ? i * 0.15 : 0)

  return (
    <ol
      aria-label="Progreso del trazado"
      className={cn('flex flex-col sm:flex-row sm:items-start', className)}
    >
      {SELLOS.map((s, i) => {
        const estado = estadoDe(i)
        const ultimo = i === SELLOS.length - 1
        const tramo: 'hecho' | 'curso' | 'pendiente' =
          completo || i + 1 <= actual
            ? 'hecho'
            : i === actual && !error
              ? 'curso'
              : 'pendiente'
        const circulo = (
          <Circulo estado={estado} icono={s.icono} retardo={retardo(i)} />
        )
        return (
          <li
            key={s.id}
            className={cn(
              'relative flex items-start gap-4 sm:flex-1 sm:flex-col sm:items-center sm:gap-3 sm:text-center',
              !ultimo && 'pb-9 sm:pb-0'
            )}
          >
            {!ultimo ? (
              <Tramo estado={tramo} retardo={retardo(i) + 0.05} />
            ) : null}
            {i === 0 && origenLayoutId ? (
              <m.span
                layoutId={origenLayoutId}
                className="relative z-[1] inline-flex rounded-full"
              >
                {circulo}
              </m.span>
            ) : (
              <span className="relative z-[1] inline-flex">{circulo}</span>
            )}
            <span
              className={cn(
                'pt-2.5 text-caption sm:max-w-[16ch] sm:pt-0',
                estado === 'activo' || estado === 'error'
                  ? 'font-semibold text-fg'
                  : estado === 'hecho'
                    ? 'text-fg-muted'
                    : 'text-fg-subtle'
              )}
            >
              {s.texto}
              <span className="sr-only">
                {estado === 'hecho'
                  ? ' (hecho)'
                  : estado === 'activo'
                    ? ' (en curso)'
                    : estado === 'error'
                      ? ' (con error)'
                      : ' (pendiente)'}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Circulo({
  estado,
  icono,
  retardo,
}: {
  estado: EstadoSello
  icono: ReactNode
  retardo: number
}) {
  const base =
    'grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-[18px] [&_svg]:stroke-[1.75]'
  if (estado === 'hecho') {
    return (
      <m.span
        key="hecho"
        aria-hidden="true"
        className={cn(base, 'bg-fg text-fg-inverse [&_svg]:stroke-[2.5]')}
        initial={{ scale: 1.3, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: -6, opacity: 1 }}
        transition={{ duration: 0.24, ease: EASE.sello, delay: retardo }}
      >
        <Check />
      </m.span>
    )
  }
  if (estado === 'error') {
    return (
      <span
        aria-hidden="true"
        className={cn(base, 'border-2 border-danger bg-danger-bg text-danger')}
      >
        <X />
      </span>
    )
  }
  if (estado === 'activo') {
    return (
      <span
        aria-hidden="true"
        className={cn(base, 'border-2 border-primary bg-bg')}
      >
        <span className="size-2.5 rounded-full bg-primary" />
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn(base, 'border-2 border-border-strong bg-bg text-fg-subtle')}
    >
      {icono}
    </span>
  )
}

/** Tramo hasta el siguiente sello: punteado de base + relleno sólido. */
function Tramo({
  estado,
  retardo,
}: {
  estado: 'hecho' | 'curso' | 'pendiente'
  retardo: number
}) {
  const punteado = cn(
    'stroke-[2]',
    estado === 'curso' ? 'stroke-primary animate-hormigas' : 'stroke-rule'
  )
  return (
    <>
      {/* Horizontal (≥ 640 px): del borde de este sello al del siguiente */}
      <span
        aria-hidden="true"
        className="absolute top-[19px] right-[calc(-50%+28px)] left-[calc(50%+28px)] hidden h-0.5 sm:block"
      >
        <svg className="absolute inset-0 h-full w-full overflow-visible">
          <line
            x1="0"
            y1="1"
            x2="100%"
            y2="1"
            strokeDasharray="4 6"
            strokeLinecap="round"
            className={punteado}
          />
        </svg>
        {estado === 'hecho' ? (
          <m.span
            className="absolute inset-0 origin-left rounded-full bg-fg"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.4, ease: EASE.tinta, delay: retardo }}
          />
        ) : null}
      </span>
      {/* Vertical (< 640 px) */}
      <span
        aria-hidden="true"
        className="absolute top-12 bottom-1 left-[19px] w-0.5 sm:hidden"
      >
        <svg className="absolute inset-0 h-full w-full overflow-visible">
          <line
            x1="1"
            y1="0"
            x2="1"
            y2="100%"
            strokeDasharray="4 6"
            strokeLinecap="round"
            className={punteado}
          />
        </svg>
        {estado === 'hecho' ? (
          <m.span
            className="absolute inset-0 origin-top rounded-full bg-fg"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.4, ease: EASE.tinta, delay: retardo }}
          />
        ) : null}
      </span>
    </>
  )
}
