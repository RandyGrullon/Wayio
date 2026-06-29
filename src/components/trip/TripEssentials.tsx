'use client'

import { useMemo, useState } from 'react'
import { Plane, Hotel, Car, Check, ExternalLink } from 'lucide-react'
import type { Trip } from '@/types/trip'
import { formatCurrency } from '@/lib/utils/formatters'
import {
  buildSkyscannerLink,
  buildBookingLink,
} from '@/constants/affiliateLinks'
import { ReserveButton } from '@/components/trip/ReserveButton'

interface TripEssentialsProps {
  itinerary: Trip
  origen: string
  personas: number
  fechaInicio: string
  fechaFin: string
  moneda: string
}

type Tier = 'basico' | 'confort' | 'premium'

// Per-tier estimates. Rough but transparent — the real booking links refine them.
const FLIGHT_PP: Record<Tier, number> = {
  basico: 480,
  confort: 720,
  premium: 1400,
}
const HOTEL_NIGHTLY: Record<Tier, number> = {
  basico: 55,
  confort: 120,
  premium: 260,
}
const CAR_DAILY: Record<Tier, number> = { basico: 35, confort: 55, premium: 95 }

function nightsBetween(inicio: string, fin: string): number {
  const a = Date.parse(inicio)
  const b = Date.parse(fin)
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 1
  return Math.max(1, Math.round((b - a) / 86_400_000))
}

/**
 * "Completa tu viaje": the AI itinerary covers what to *do*; this covers how to
 * get there and stay. The flight is included in the trip total by default
 * (you can't visit Tokyo without one), and the app proactively asks whether the
 * traveler already has lodging / needs a car, adding each as a priced extra and
 * linking to the real booking. Estimates are per-tier and clearly labelled.
 */
export function TripEssentials({
  itinerary,
  origen,
  personas,
  fechaInicio,
  fechaFin,
  moneda,
}: TripEssentialsProps) {
  const tier = (itinerary.paquete as Tier) ?? 'confort'
  const nights = useMemo(
    () => nightsBetween(fechaInicio, fechaFin),
    [fechaInicio, fechaFin]
  )
  const rooms = Math.max(1, Math.ceil(personas / 2))

  const flightEst = personas * FLIGHT_PP[tier]
  const hotelEst = nights * rooms * HOTEL_NIGHTLY[tier]
  const carEst = (nights + 1) * CAR_DAILY[tier]

  // Flight is on by default; lodging/car start unanswered so we can *ask*.
  const [flight, setFlight] = useState(true)
  const [lodging, setLodging] = useState<'have' | 'add' | null>(null)
  const [car, setCar] = useState<'add' | 'no' | null>(null)

  const extras =
    (flight ? flightEst : 0) +
    (lodging === 'add' ? hotelEst : 0) +
    (car === 'add' ? carEst : 0)
  const total = itinerary.presupuestoTotal + extras
  const perPerson = Math.round(total / Math.max(1, personas))

  const fmt = (n: number) => formatCurrency(n, moneda)

  return (
    <div className="mb-6 rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <h3 className="text-base font-bold text-fg">Completa tu viaje</h3>
      <p className="mt-0.5 text-sm text-fg-muted">
        El itinerario cubre qué hacer. Esto cubre cómo llegar y dónde dormir —
        ajusta el total a lo que de verdad vas a gastar.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {/* Flight — included by default */}
        <EssentialCard
          icon={<Plane className="h-5 w-5 text-brand-500" />}
          title="Vuelo (ida y vuelta)"
          subtitle={`${personas} ${personas === 1 ? 'pasajero' : 'pasajeros'} · estimado`}
          price={fmt(flightEst)}
          active={flight}
        >
          <Toggle
            on={flight}
            onLabel="Incluido"
            offLabel="Ya lo tengo"
            onToggle={() => setFlight((v) => !v)}
          />
          <SearchLink
            href={buildSkyscannerLink(origen, itinerary.destino, fechaInicio)}
            label="Ver vuelos reales"
          />
        </EssentialCard>

        {/* Lodging — ask */}
        <EssentialCard
          icon={<Hotel className="h-5 w-5 text-coral-500" />}
          title="Hospedaje"
          subtitle={`${nights} ${nights === 1 ? 'noche' : 'noches'} · ${rooms} ${
            rooms === 1 ? 'habitación' : 'habitaciones'
          } · estimado`}
          price={fmt(hotelEst)}
          active={lodging === 'add'}
        >
          {lodging === null ? (
            <Ask
              question="¿Ya tienes hospedaje?"
              yesLabel="Sí, ya tengo"
              noLabel="No, agrégalo"
              onYes={() => setLodging('have')}
              onNo={() => setLodging('add')}
            />
          ) : (
            <Toggle
              on={lodging === 'add'}
              onLabel="Agregado al total"
              offLabel="Ya tengo"
              onToggle={() => setLodging((v) => (v === 'add' ? 'have' : 'add'))}
            />
          )}
          <SearchLink
            href={buildBookingLink(itinerary.destino, fechaInicio)}
            label="Ver hoteles reales"
          />
        </EssentialCard>

        {/* Car — ask */}
        <EssentialCard
          icon={<Car className="h-5 w-5 text-brand-500" />}
          title="Alquiler de carro"
          subtitle={`${nights + 1} ${nights + 1 === 1 ? 'día' : 'días'} · estimado`}
          price={fmt(carEst)}
          active={car === 'add'}
        >
          {car === null ? (
            <Ask
              question="¿Necesitas carro?"
              yesLabel="Sí, agrégalo"
              noLabel="No hace falta"
              onYes={() => setCar('add')}
              onNo={() => setCar('no')}
            />
          ) : (
            <Toggle
              on={car === 'add'}
              onLabel="Agregado al total"
              offLabel="No hace falta"
              onToggle={() => setCar((v) => (v === 'add' ? 'no' : 'add'))}
            />
          )}
          <SearchLink
            href={`https://www.booking.com/cars/index.html?aid=TU_ID&ss=${encodeURIComponent(
              itinerary.destino
            )}`}
            label="Ver carros reales"
          />
        </EssentialCard>
      </div>

      {/* Live total */}
      <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
            Total estimado del viaje
          </p>
          <p className="mt-0.5 text-2xl font-extrabold text-fg">{fmt(total)}</p>
          <p className="text-xs text-fg-muted">
            {fmt(perPerson)} / persona · incluye{' '}
            {[
              'plan',
              flight ? 'vuelo' : null,
              lodging === 'add' ? 'hospedaje' : null,
              car === 'add' ? 'carro' : null,
            ]
              .filter(Boolean)
              .join(' + ')}
          </p>
        </div>
        <ReserveButton
          tripId={itinerary.id}
          destino={itinerary.destino}
          presupuestoTotal={total}
          moneda={moneda}
        />
      </div>
    </div>
  )
}

function EssentialCard({
  icon,
  title,
  subtitle,
  price,
  active,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  price: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-2xl border p-3.5 transition-colors ${
        active
          ? 'border-brand-300 bg-brand-50/60 dark:border-brand-500/40 dark:bg-brand-500/10'
          : 'border-border bg-bg'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold text-fg">{title}</p>
            <span className="shrink-0 text-sm font-bold text-fg">{price}</span>
          </div>
          <p className="text-xs text-fg-muted">{subtitle}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function Ask({
  question,
  yesLabel,
  noLabel,
  onYes,
  onNo,
}: {
  question: string
  yesLabel: string
  noLabel: string
  onYes: () => void
  onNo: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-fg-muted">{question}</span>
      <button
        type="button"
        onClick={onNo}
        className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
      >
        {noLabel}
      </button>
      <button
        type="button"
        onClick={onYes}
        className="rounded-lg border border-border-strong px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-muted"
      >
        {yesLabel}
      </button>
    </div>
  )
}

function Toggle({
  on,
  onLabel,
  offLabel,
  onToggle,
}: {
  on: boolean
  onLabel: string
  offLabel: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
        on
          ? 'bg-brand-600 text-white hover:bg-brand-700'
          : 'border border-border-strong text-fg-muted hover:bg-surface-muted'
      }`}
    >
      {on ? <Check className="h-3.5 w-3.5" /> : null}
      {on ? onLabel : offLabel}
    </button>
  )
}

function SearchLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
    >
      {label} <ExternalLink className="h-3 w-3" />
    </a>
  )
}
