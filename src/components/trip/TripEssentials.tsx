'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Car,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Hotel,
  Plane,
  TriangleAlert,
} from 'lucide-react'
import type { Trip } from '@/types/trip'
import { Card, CardFranja } from '@/components/ui/Card'
import { Switch } from '@/components/ui/Switch'
import {
  AFFILIATE_REL,
  buildBookingLink,
  buildCarRentalLink,
  describeFlightsLink,
} from '@/constants/affiliateLinks'
import type {
  ProveedorAfiliado,
  CategoriaAfiliado,
} from '@/lib/analytics/events'
import { track } from '@/lib/analytics/events'
import {
  formatCurrency,
  formatDias,
  formatNoches,
  formatViajeros,
} from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { Dinero } from './Dinero'
import { calcularTotal, seleccionInicial } from './totalEstimado'
import type { DesgloseTotal, SeleccionExtras } from './totalEstimado'
import { monedaDelViaje } from './tripUtils'

interface TripEssentialsProps {
  itinerary: Trip
  origen: string
  personas: number
  fechaInicio: string
  fechaFin: string
  /** @deprecated Se usa la moneda del viaje (trip.moneda). */
  moneda?: string
  /** Selección controlada desde fuera (el total aparece también en la franja). */
  seleccion?: SeleccionExtras
  onSeleccionChange?: (seleccion: SeleccionExtras) => void
  /** Presupuesto del formulario, para el encaje. */
  presupuesto?: { monto: number; moneda?: string | undefined } | null
  /** Acción de reserva bajo el total (p. ej. ReserveButton). */
  reserva?: ReactNode
  /** Id guardado del viaje (analítica). */
  tripId?: string
  className?: string
}

const COLOR_PARTIDA: Record<
  DesgloseTotal['partidas'][number]['clave'],
  string
> = {
  plan: 'bg-dia-2',
  vuelo: 'bg-dia-7',
  hospedaje: 'bg-dia-3',
  carro: 'bg-dia-6',
}

/**
 * «Completa tu viaje» (docs/DISENO.md §6.5): vuelo, hospedaje y carro como
 * boletos compactos (switch, estimación y enlace patrocinado) y UNA tarjeta
 * «TOTAL ESTIMADO» con barra apilada, total por persona y encaje con el
 * presupuesto. Sustituye a BudgetDisplay y a los totales contradictorios.
 */
export function TripEssentials({
  itinerary,
  origen,
  personas,
  fechaInicio,
  fechaFin,
  seleccion: seleccionControlada,
  onSeleccionChange,
  presupuesto = null,
  reserva,
  tripId,
  className,
}: TripEssentialsProps) {
  const [seleccionLocal, setSeleccionLocal] = useState<SeleccionExtras>(() =>
    seleccionInicial(itinerary)
  )
  const seleccion = seleccionControlada ?? seleccionLocal
  const cambiar = (parcial: Partial<SeleccionExtras>) => {
    const nueva = { ...seleccion, ...parcial }
    if (onSeleccionChange) onSeleccionChange(nueva)
    else setSeleccionLocal(nueva)
  }

  const trip: Trip = { ...itinerary, personas: personas || itinerary.personas }
  const moneda = monedaDelViaje(itinerary)
  const desglose = calcularTotal(trip, seleccion, presupuesto)
  const fmt = (n: number) => formatCurrency(n, moneda)

  const vuelos = describeFlightsLink({
    origen,
    destino: itinerary.destino,
    ida: fechaInicio,
    vuelta: fechaFin,
    personas: desglose.personas,
  })
  const hoteles = buildBookingLink(itinerary.destino, fechaInicio, {
    checkOut: fechaFin,
    adultos: desglose.personas,
    habitaciones: Math.max(1, Math.ceil(desglose.personas / 2)),
  })
  const clic = (proveedor: ProveedorAfiliado, categoria: CategoriaAfiliado) =>
    track('click_afiliado', {
      proveedor,
      categoria,
      destino: itinerary.destino,
      tripId,
      ubicacion: 'completa-tu-viaje',
    })

  return (
    <section
      aria-labelledby="completa-tu-viaje"
      className={cn('scroll-mt-24', className)}
    >
      <p className="kicker kicker-filete">Cómo llegar y dónde dormir</p>
      <h2 id="completa-tu-viaje" className="mt-3 font-display text-h2 text-fg">
        Completa tu viaje
      </h2>
      <p className="mt-2 max-w-[60ch] text-body-s text-fg-muted">
        El itinerario cubre qué hacer. Ajusta el total a lo que de verdad vas a
        gastar.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {/* Vuelo */}
        <Boleto
          franja="Vuelo · ida y vuelta"
          icono={<Plane />}
          valor={
            desglose.vuelo === null
              ? null
              : desglose.vuelo === 0
                ? 'No hace falta volar'
                : fmt(desglose.vuelo)
          }
          detalle={
            desglose.vuelo === null
              ? 'Sin estimación para este viaje. Consulta el precio real.'
              : desglose.vuelo === 0
                ? 'Tu origen está cerca del destino.'
                : `${fmt(desglose.vueloPorPersona ?? 0)} por persona · ${formatViajeros(desglose.personas)}`
          }
          control={
            desglose.vuelo !== null && desglose.vuelo > 0 ? (
              <Switch
                checked={seleccion.vuelo}
                onCheckedChange={(v) => cambiar({ vuelo: v })}
                label="Sumar al total"
                description={origen ? `Desde ${origen}` : undefined}
              />
            ) : null
          }
          enlace={{
            href: vuelos.url,
            texto: 'Ver vuelos',
            onClick: () => clic(vuelos.proveedor, 'vuelo'),
          }}
        />

        {/* Hospedaje */}
        <Boleto
          franja="Hospedaje"
          icono={<Hotel />}
          valor={desglose.hospedajeIncluido ? fmt(desglose.hospedaje) : null}
          detalle={
            desglose.hospedajeIncluido
              ? `${formatNoches(desglose.noches)} · ya incluido en tu plan${desglose.hoteles[0] ? ` (${desglose.hoteles[0]})` : ''}`
              : 'Busca dónde dormir según tus fechas.'
          }
          control={
            desglose.hospedajeIncluido ? (
              <Switch
                checked={seleccion.hospedaje}
                onCheckedChange={(v) => cambiar({ hospedaje: v })}
                label="Sumar al total"
                description="Desmárcalo si ya tienes dónde dormir."
              />
            ) : null
          }
          enlace={{
            href: hoteles,
            texto: 'Ver hoteles',
            onClick: () => clic('booking', 'hotel'),
          }}
        />

        {/* Carro */}
        <Boleto
          franja="Alquiler de carro"
          icono={<Car />}
          valor={fmt(desglose.carro)}
          detalle={`${formatDias(desglose.dias)} · estimación orientativa`}
          control={
            <Switch
              checked={seleccion.carro}
              onCheckedChange={(v) => cambiar({ carro: v })}
              label="Sumar al total"
            />
          }
          enlace={{
            href: buildCarRentalLink(),
            texto: 'Ver carros',
            onClick: () => clic('booking_cars', 'carro'),
          }}
        />
      </div>

      <TotalEstimado desglose={desglose} reserva={reserva} className="mt-6" />
    </section>
  )
}

function Boleto({
  franja,
  icono,
  valor,
  detalle,
  control,
  enlace,
}: {
  franja: string
  icono: ReactNode
  valor: string | null
  detalle: string
  control: ReactNode
  enlace: { href: string; texto: string; onClick: () => void }
}) {
  return (
    <Card variant="boleto" className="flex flex-col">
      <CardFranja extra={valor ? 'Estimado' : undefined}>{franja}</CardFranja>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-1 inline-flex text-fg-subtle [&_svg]:size-5 [&_svg]:stroke-[1.75]"
          >
            {icono}
          </span>
          <div className="min-w-0">
            <p className="font-display text-[22px] leading-tight text-fg tnum">
              {valor ?? 'Precio real'}
            </p>
            <p className="mt-1 text-caption text-fg-muted">{detalle}</p>
          </div>
        </div>
        {control ? (
          <div className="border-t border-border pt-3">{control}</div>
        ) : null}
        <a
          href={enlace.href}
          target="_blank"
          rel={AFFILIATE_REL}
          onClick={enlace.onClick}
          className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-sm text-[14px] font-semibold text-accent underline decoration-1 underline-offset-[3px] hover:text-accent-hover"
        >
          {enlace.texto}
          <ExternalLink
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-4"
          />
          <span className="sr-only">
            (enlace patrocinado, se abre en otra pestaña)
          </span>
        </a>
      </div>
    </Card>
  )
}

const ICONO_ENCAJE = {
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
} as const

const TONO_ENCAJE = {
  success: { texto: 'text-success-fg', barra: 'bg-success' },
  warning: { texto: 'text-warning-fg', barra: 'bg-warning' },
  danger: { texto: 'text-danger-fg', barra: 'bg-danger' },
} as const

/** La tarjeta única «TOTAL ESTIMADO» (también se usa en otros contextos). */
export function TotalEstimado({
  desglose,
  reserva,
  className,
}: {
  desglose: DesgloseTotal
  reserva?: ReactNode
  className?: string
}) {
  const { moneda, partidas, total, porPersona, encaje } = desglose
  const fmt = (n: number) => formatCurrency(n, moneda)
  const IconoEncaje = encaje ? ICONO_ENCAJE[encaje.tono] : null
  return (
    <Card
      variant="elevated"
      as="section"
      aria-labelledby="total-estimado"
      className={cn('grid gap-6 lg:grid-cols-2 lg:gap-10', className)}
    >
      <div>
        <h3 id="total-estimado" className="kicker">
          Total estimado
        </h3>
        <p className="mt-2 text-num-xl text-fg">
          <Dinero valor={total} moneda={moneda} />
        </p>
        <p className="mt-1 text-body-s text-fg-muted">
          <span className="tnum">{fmt(porPersona)}</span> por persona ·{' '}
          {formatViajeros(desglose.personas)}
        </p>

        {encaje && IconoEncaje ? (
          <div className="mt-5">
            <p
              className={cn(
                'flex items-center gap-2 text-[15px] font-semibold',
                TONO_ENCAJE[encaje.tono].texto
              )}
            >
              <IconoEncaje
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-5 shrink-0"
              />
              {encaje.texto}
            </p>
            <div
              aria-hidden="true"
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-(--dur-slow) ease-papel',
                  TONO_ENCAJE[encaje.tono].barra
                )}
                style={{ width: `${Math.min(100, encaje.porcentaje)}%` }}
              />
            </div>
          </div>
        ) : null}

        {reserva ? <div className="mt-6">{reserva}</div> : null}
      </div>

      <div>
        <div
          aria-hidden="true"
          className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2"
        >
          {partidas
            .filter((p) => p.valor > 0)
            .map((p) => (
              <span
                key={p.clave}
                className={cn('wy-tramo-total h-full', COLOR_PARTIDA[p.clave])}
                style={{ flexGrow: p.valor, flexBasis: 0 }}
              />
            ))}
        </div>
        <dl className="mt-4 divide-y divide-border">
          {partidas.map((p) => (
            <div
              key={p.clave}
              className="flex items-center justify-between gap-4 py-2.5 text-body-s"
            >
              <dt className="flex items-center gap-2 text-fg-muted">
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-2.5 rounded-full',
                    COLOR_PARTIDA[p.clave]
                  )}
                />
                {p.etiqueta}
              </dt>
              <dd className="font-semibold text-fg tnum">{fmt(p.valor)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-caption text-fg-subtle">
          Estimación orientativa en {moneda}. Los precios reales se confirman al
          reservar.
        </p>
      </div>
    </Card>
  )
}
