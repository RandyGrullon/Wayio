'use client'

import { Navigation, Undo2 } from 'lucide-react'
import type { Activity } from '@/types/activity'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { buildNavigationLinks } from '@/constants/affiliateLinks'
import { formatDuracion, formatHora12 } from '@/lib/utils/formatters'
import { tieneCoords } from '@/components/trip/tripUtils'
import type { EstadoHoy } from './hoy'

interface TarjetaAhoraProps {
  hoy: EstadoHoy
  ahora: Date
  /** Puede marcar actividades como perdidas (solo el dueño y con conexión). */
  puedeReagendar: boolean
  onPerdida: (actividad: Activity) => void
}

/**
 * Tarjeta AHORA invertida (docs/DISENO.md §6.6): la actividad en curso con
 * la barra de tiempo transcurrido y «Siguiente en 35 min · … · 8 min a pie».
 * Tocar la tarjeta no marca nada: «Me la perdí» es un botón explícito.
 */
export function TarjetaAhora({
  hoy,
  ahora,
  puedeReagendar,
  onPerdida,
}: TarjetaAhoraProps) {
  const foco = hoy.actual ?? hoy.siguiente
  const kicker = hoy.actual
    ? `Ahora · ${formatHora12(ahora)}`
    : hoy.siguiente
      ? `A continuación · ${formatHora12(hoy.siguiente.horaInicio)}`
      : `Hoy · ${formatHora12(ahora)}`
  const nav =
    foco && tieneCoords(foco)
      ? buildNavigationLinks(foco.lat, foco.lng, foco.nombre)
      : null
  const pct = Math.round(hoy.progreso * 100)

  return (
    <Card variant="inverse" as="section" aria-labelledby="ahora-titulo">
      <p className="kicker text-fg-inverse/80">{kicker}</p>
      <h2
        id="ahora-titulo"
        className="mt-2 font-display text-[28px] leading-tight text-fg-inverse"
      >
        {foco ? foco.nombre : 'No quedan actividades para hoy'}
      </h2>

      {hoy.actual ? (
        <div className="mt-4">
          <div
            role="progressbar"
            aria-label="Tiempo transcurrido de la actividad"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-valuetext={`${pct} % del tiempo previsto`}
            className="h-1.5 w-full overflow-hidden rounded-full bg-fg-inverse/15"
          >
            <div
              className="h-full rounded-full bg-fg-inverse transition-[width] duration-(--dur-slow) ease-papel"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-caption text-fg-inverse/80 tnum">
            {formatHora12(hoy.actual.horaInicio)} –{' '}
            {formatHora12(hoy.actual.horaFin)}
          </p>
        </div>
      ) : null}

      <p className="mt-4 text-body-s text-fg-inverse/90">
        {hoy.actual && hoy.siguiente && hoy.minutosParaSiguiente !== null
          ? [
              `Siguiente en ${formatDuracion(hoy.minutosParaSiguiente)}`,
              hoy.siguiente.nombre,
              hoy.actual.tiempoHastaSiguiente > 0
                ? `${formatDuracion(hoy.actual.tiempoHastaSiguiente)} de camino`
                : '',
            ]
              .filter(Boolean)
              .join(' · ')
          : !hoy.actual && hoy.siguiente && hoy.minutosParaSiguiente !== null
            ? `Empieza en ${formatDuracion(hoy.minutosParaSiguiente)}`
            : hoy.actual
              ? 'Es la última actividad del día.'
              : 'Disfruta el resto del día a tu ritmo.'}
      </p>

      {foco ? (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          {nav ? (
            <ButtonLink
              href={nav.google}
              target="_blank"
              variant="primary"
              size="lg"
              icon={<Navigation />}
              className="w-full sm:w-auto"
            >
              Cómo llegar
            </ButtonLink>
          ) : null}
          {puedeReagendar ? (
            <Button
              variant="ghost"
              size="lg"
              icon={<Undo2 />}
              onClick={() => onPerdida(foco)}
              className="w-full text-fg-inverse hover:bg-fg-inverse/10 sm:w-auto"
            >
              Me la perdí
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}
