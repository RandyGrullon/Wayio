'use client'

import type { ReactNode } from 'react'
import type { Day, Trip } from '@/types/trip'
import type { Activity } from '@/types/activity'
import { diaClases } from '@/constants/mapColors'
import { formatCurrency, formatFecha } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { ActivityItem } from './ActivityItem'
import { ciudadDelDia, fechaDelDia } from './tripUtils'

export interface DayChapterProps {
  dia: Day
  /** Índice del día (0 = día 1). */
  indice: number
  trip: Pick<Trip, 'fechaInicio' | 'destino' | 'id'>
  /** Moneda del viaje. */
  moneda: string
  modo?: 'completo' | 'lectura'
  /** Prefijo del id de la sección (anclas de los chips de día). */
  idPrefijo?: string
  resaltados?: ReadonlySet<string>
  claveResaltado?: number
  /** Acciones extra por actividad (p. ej. «Me la perdí» en el viaje en vivo). */
  accionesActividad?: (actividad: Activity) => ReactNode
  /** Contenido extra al final del capítulo (p. ej. «Añadir actividad»). */
  pie?: ReactNode
  /** Sustituye la lista de actividades (modo edición). */
  children?: ReactNode
  animar?: boolean
  className?: string
}

/** «Día 01 · sáb, 12 nov» (el kicker lo pasa a mayúsculas). */
export function kickerDelDia(
  trip: Pick<Trip, 'fechaInicio'>,
  indice: number
): string {
  const fecha = fechaDelDia(trip, indice)
  const n = String(indice + 1).padStart(2, '0')
  return fecha ? `Día ${n} · ${formatFecha(fecha)}` : `Día ${n}`
}

/**
 * Un día como capítulo (docs/DISENO.md §6.5): kicker en el color del día,
 * título en Newsreader, meta con la ciudad y el gasto en la moneda del viaje
 * y el timeline como <ol>. Un día por página al imprimir.
 */
export function DayChapter({
  dia,
  indice,
  trip,
  moneda,
  modo = 'completo',
  idPrefijo = 'dia',
  resaltados,
  claveResaltado = 0,
  accionesActividad,
  pie,
  children,
  animar = false,
  className,
}: DayChapterProps) {
  const ciudad = ciudadDelDia(dia, trip)
  const idTitulo = `${idPrefijo}-${indice + 1}-titulo`
  const total = dia.actividades.length
  return (
    <section
      id={`${idPrefijo}-${indice + 1}`}
      data-dia-capitulo={indice}
      data-print="page"
      aria-labelledby={idTitulo}
      className={cn('scroll-mt-36 md:scroll-mt-40', className)}
    >
      <header>
        <p className={cn('kicker', diaClases(indice).text)}>
          {kickerDelDia(trip, indice)}
        </p>
        <h2 id={idTitulo} className="mt-2 font-display text-h2 text-fg">
          {dia.titulo?.trim() || `Día ${indice + 1}`}
        </h2>
        <p className="mt-1.5 text-body-s text-fg-muted">
          {ciudad}
          {dia.presupuestoDia > 0 ? (
            <>
              {' · '}
              <span className="tnum">
                {formatCurrency(dia.presupuestoDia, moneda)}
              </span>{' '}
              estimado
            </>
          ) : null}
        </p>
        {dia.descripcion?.trim() ? (
          <p className="mt-3 max-w-prose text-body-s text-fg-muted">
            {dia.descripcion}
          </p>
        ) : null}
      </header>

      {children ??
        (total === 0 ? (
          <p className="mt-6 text-body-s text-fg-subtle">
            Día libre: no hay actividades planificadas.
          </p>
        ) : (
          <ol className="mt-6" aria-label={`Actividades del día ${indice + 1}`}>
            {dia.actividades.map((act, i) => (
              <ActivityItem
                key={act.id}
                activity={act}
                dia={indice}
                orden={i + 1}
                moneda={moneda}
                ciudad={ciudad}
                destino={trip.destino}
                tripId={trip.id}
                modo={modo}
                resaltado={resaltados?.has(act.id) ?? false}
                claveResaltado={claveResaltado}
                acciones={accionesActividad?.(act)}
                ultima={i === total - 1}
                animar={animar}
                indiceAnimacion={i}
              />
            ))}
          </ol>
        ))}
      {pie}
    </section>
  )
}
