'use client'

import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { m } from 'framer-motion'
import {
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  Ticket,
  Wallet,
} from 'lucide-react'
import type { Activity } from '@/types/activity'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import {
  AFFILIATE_REL,
  buildActivityLink,
  buildBookingLink,
  buildNavigationLinks,
} from '@/constants/affiliateLinks'
import { diaClases } from '@/constants/mapColors'
import { track } from '@/lib/analytics/events'
import {
  formatCurrency,
  formatDuracion,
  formatHora12,
  formatHora12Partes,
} from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { EASE } from '@/components/ui/motion'
import { TIPO_LABEL, esCheckIn, tieneCoords } from './tripUtils'
import './trip.css'

export interface ActivityItemProps {
  activity: Activity
  /** Índice del día (0 = día 1): color del punto del riel. */
  dia?: number
  /** Número de parada dentro del día (para lectores). */
  orden?: number
  /** Moneda de los importes (SIEMPRE la del viaje). */
  moneda?: string
  /** Ciudad del día: se usa para el enlace de reserva. */
  ciudad?: string
  /** Destino del viaje (analítica). */
  destino?: string
  /** Id del viaje (analítica). */
  tripId?: string
  /**
   * completo: «Cómo llegar» y «Reservar» (patrocinado).
   * lectura: solo «Cómo llegar» (vista compartida).
   */
  modo?: 'completo' | 'lectura'
  /** Resalta la fila (cambió tras un ajuste); `claveResaltado` lo reinicia. */
  resaltado?: boolean
  claveResaltado?: number
  /** Acciones extra al final (p. ej. «Me la perdí»). */
  acciones?: ReactNode
  /** Contenido bajo la fila (controles de edición, editor en línea). */
  pie?: ReactNode
  /** Es la última del día: el riel termina en su punto. */
  ultima?: boolean
  /** Entrada con whileInView (resultado). */
  animar?: boolean
  indiceAnimacion?: number
  /** Etiqueta raíz: li dentro de un <ol> (por defecto) o div. */
  as?: 'li' | 'div'
  /** @deprecated La fila ya no es un botón: usa `acciones`. */
  onSelect?: (activity: Activity) => void
  className?: string
}

const PROVEEDOR_ACTIVIDAD = 'viator' as const

/**
 * Fila del timeline de un día (docs/DISENO.md §6.5): columna de hora en 12 h,
 * riel punteado con el punto del color del día y contenido sin caja.
 * El enlace de reserva se construye AL RENDERIZAR (buildActivityLink), nunca
 * se lee el `linkAfiliado` guardado.
 */
export function ActivityItem({
  activity,
  dia = 0,
  orden,
  moneda = 'USD',
  ciudad = '',
  destino,
  tripId,
  modo = 'completo',
  resaltado = false,
  claveResaltado = 0,
  acciones,
  pie,
  ultima = false,
  animar = false,
  indiceAnimacion = 0,
  as = 'li',
  className,
}: ActivityItemProps) {
  const idDetalle = useId()
  const [abierto, setAbierto] = useState(false)
  const inicio = formatHora12Partes(activity.horaInicio)
  const fin = formatHora12(activity.horaFin)
  const coords = tieneCoords(activity)
  const nav = coords
    ? buildNavigationLinks(activity.lat, activity.lng, activity.nombre)
    : null
  const checkIn = esCheckIn(activity)
  const perdida = activity.estado === 'perdida' || activity.esPerdida
  const completada = activity.estado === 'completada'
  // Viajes guardados antiguos (o vistas compartidas) pueden traer campos vacíos.
  const descripcion = activity.descripcion ?? ''
  const consejos = (activity.consejos ?? []).filter(
    (c) => typeof c === 'string' && c.trim()
  )
  const hayDetalle =
    descripcion.length > 140 ||
    consejos.length > 0 ||
    Boolean(activity.mejorHoraVisita?.trim())

  const reserva =
    modo === 'completo' && !activity.reservaPagada && !perdida
      ? checkIn
        ? {
            url: buildBookingLink(
              `${activity.nombre.replace(/^\s*check-?in\s*(en|:)?\s*/i, '')} ${ciudad}`.trim()
            ),
            etiqueta: 'Ver hotel',
            proveedor: 'booking' as const,
            categoria: 'hotel' as const,
          }
        : activity.reservaRequerida && activity.tipo !== 'traslado'
          ? {
              url: buildActivityLink(activity.nombre, ciudad),
              etiqueta: 'Reservar',
              proveedor: PROVEEDOR_ACTIVIDAD,
              categoria: 'actividad' as const,
            }
          : null
      : null

  const clases = cn(
    'relative isolate grid grid-cols-[56px_20px_minmax(0,1fr)] gap-x-2 sm:grid-cols-[64px_20px_minmax(0,1fr)] sm:gap-x-3',
    className
  )
  const animacion = {
    'data-wy-revelar': '',
    initial: { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: {
      duration: 0.36,
      ease: EASE.papel,
      delay: Math.min(indiceAnimacion, 10) * 0.03,
    },
  }

  const contenido = (
    <>
      {resaltado ? (
        <span
          key={claveResaltado}
          aria-hidden="true"
          className="wy-resaltado pointer-events-none absolute -inset-x-3 inset-y-0 -z-10 rounded-control"
        />
      ) : null}

      {/* Hora */}
      <div className="pt-0.5 text-right">
        {inicio ? (
          <p className="leading-tight">
            <time
              dateTime={activity.horaInicio}
              className="block text-[15px] font-semibold text-fg tnum"
            >
              {inicio.hora}
            </time>
            <span className="text-caption text-fg-muted">{inicio.periodo}</span>
          </p>
        ) : null}
        {fin ? (
          <p className="mt-1 text-caption text-fg-subtle tnum">
            <span className="sr-only">hasta las </span>
            {fin}
          </p>
        ) : null}
      </div>

      {/* Riel punteado + punto del día */}
      <div aria-hidden="true" className="relative flex justify-center">
        {!ultima ? (
          <span className="absolute top-2 bottom-0 left-1/2 w-0 -translate-x-1/2 border-l-2 border-dotted border-rule" />
        ) : null}
        <span
          className={cn(
            'relative mt-1.5 size-3 rounded-full ring-4 ring-bg',
            perdida ? 'bg-fg-subtle' : diaClases(dia).bg
          )}
        />
      </div>

      {/* Contenido */}
      <div className={cn('min-w-0 pb-6', !ultima && 'border-b border-border')}>
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
          <h3
            className={cn(
              'min-w-0 text-title',
              perdida ? 'text-fg-muted line-through' : 'text-fg'
            )}
          >
            {orden ? <span className="sr-only">Parada {orden}: </span> : null}
            {activity.nombre}
          </h3>
          <Badge>{TIPO_LABEL[activity.tipo] ?? 'Actividad'}</Badge>
          {perdida ? <Badge variant="warning">Perdida</Badge> : null}
          {completada ? <Badge variant="success">Hecha</Badge> : null}
          {activity.reservaPagada ? (
            <Badge variant="success">Pagada</Badge>
          ) : null}
          {activity.reagendadaDesdeDia ? (
            <Badge variant="info">
              Movida del día {activity.reagendadaDesdeDia}
            </Badge>
          ) : null}
        </div>

        {descripcion ? (
          <p
            className={cn(
              'mt-1.5 max-w-prose text-body-s text-fg-muted',
              !abierto && 'line-clamp-2'
            )}
          >
            {descripcion}
          </p>
        ) : null}

        {abierto && hayDetalle ? (
          <div
            id={idDetalle}
            className="mt-3 max-w-prose space-y-2 text-body-s text-fg-muted"
          >
            {activity.mejorHoraVisita?.trim() ? (
              <p>
                <span className="font-semibold text-fg">Mejor momento: </span>
                {activity.mejorHoraVisita}
              </p>
            ) : null}
            {consejos.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 marker:text-brass">
                {consejos.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {hayDetalle ? (
          <button
            type="button"
            aria-expanded={abierto}
            aria-controls={abierto ? idDetalle : undefined}
            onClick={() => setAbierto((v) => !v)}
            className="mt-1 rounded-sm text-[14px] font-semibold text-accent underline decoration-1 underline-offset-[3px] hover:text-accent-hover"
            data-print="hide"
          >
            {abierto ? 'Ver menos' : 'Ver más'}
          </button>
        ) : null}

        <ul className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-fg-muted">
          {activity.duracionMinutos > 0 ? (
            <li className="inline-flex items-center gap-1.5 tnum">
              <Clock aria-hidden="true" strokeWidth={1.75} className="size-4" />
              <span className="sr-only">Duración: </span>
              {formatDuracion(activity.duracionMinutos)}
            </li>
          ) : null}
          {activity.precioEstimado > 0 ? (
            <li className="inline-flex items-center gap-1.5 tnum">
              <Wallet
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4"
              />
              <span className="sr-only">Precio estimado: </span>
              {formatCurrency(activity.precioEstimado, moneda)}
            </li>
          ) : null}
          {activity.direccion ? (
            <li className="inline-flex min-w-0 max-w-full items-center gap-1.5">
              <MapPin
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4 shrink-0"
              />
              <span className="sr-only">Dirección: </span>
              <span className="truncate" title={activity.direccion}>
                {activity.direccion}
              </span>
            </li>
          ) : null}
        </ul>

        {nav || reserva || acciones ? (
          <div
            className="mt-3 -ml-3 flex flex-wrap items-center gap-2"
            data-print="hide"
          >
            {nav ? (
              <ButtonLink
                href={nav.google}
                target="_blank"
                variant="ghost"
                size="sm"
                icon={<Navigation />}
                aria-label={`Cómo llegar a ${activity.nombre} (se abre en otra pestaña)`}
              >
                Cómo llegar
              </ButtonLink>
            ) : null}
            {reserva ? (
              <ButtonLink
                href={reserva.url}
                target="_blank"
                rel={AFFILIATE_REL}
                variant="outline"
                size="sm"
                icon={checkIn ? <ExternalLink /> : <Ticket />}
                aria-label={`${reserva.etiqueta}: ${activity.nombre} (enlace patrocinado, se abre en otra pestaña)`}
                onClick={() =>
                  track('click_afiliado', {
                    proveedor: reserva.proveedor,
                    categoria: reserva.categoria,
                    destino,
                    tripId,
                    ubicacion: 'actividad',
                  })
                }
              >
                {reserva.etiqueta}
              </ButtonLink>
            ) : null}
            {acciones}
          </div>
        ) : null}

        {!ultima && activity.tiempoHastaSiguiente > 0 ? (
          <p className="mt-4 text-caption text-fg-subtle tnum">
            {formatDuracion(activity.tiempoHastaSiguiente)} hasta la siguiente
          </p>
        ) : null}

        {pie}
      </div>
    </>
  )

  if (animar) {
    return as === 'li' ? (
      <m.li className={clases} {...animacion}>
        {contenido}
      </m.li>
    ) : (
      <m.div className={clases} {...animacion}>
        {contenido}
      </m.div>
    )
  }
  return as === 'li' ? (
    <li className={clases}>{contenido}</li>
  ) : (
    <div className={clases}>{contenido}</div>
  )
}
