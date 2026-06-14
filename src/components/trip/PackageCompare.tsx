'use client'

import type { Trip } from '@/types/trip'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/formatters'

const PACKAGE_META: Record<
  'basico' | 'confort' | 'premium',
  {
    label: string
    tier: string
    ring: string
    icon: string
    popular?: boolean
  }
> = {
  basico: {
    label: 'Básico',
    tier: 'Hoteles 3★ · Eco',
    ring: 'border-border-strong',
    icon: '🎒',
  },
  confort: {
    label: 'Confort',
    tier: 'Hoteles 4★ · Turista+',
    ring: 'border-brand-500',
    icon: '✈️',
    popular: true,
  },
  premium: {
    label: 'Premium',
    tier: 'Hoteles 5★ · Business',
    ring: 'border-sun-500',
    icon: '👑',
  },
}

interface PackageCompareProps {
  basico: Trip
  confort: Trip
  premium: Trip
  selected: 'basico' | 'confort' | 'premium'
  moneda?: string
  onSelect: (paquete: 'basico' | 'confort' | 'premium') => void
}

export function PackageCompare({
  basico,
  confort,
  premium,
  selected,
  moneda = 'USD',
  onSelect,
}: PackageCompareProps) {
  const packages: Array<[Trip, 'basico' | 'confort' | 'premium']> = [
    [basico, 'basico'],
    [confort, 'confort'],
    [premium, 'premium'],
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="text-2xl font-extrabold tracking-tight text-fg">
          Elige tu paquete
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          Generamos 3 versiones de tu viaje. Selecciona la que mejor se adapte.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {packages.map(([trip, key]) => {
          const meta = PACKAGE_META[key]
          const actividadesPagadas = trip.dias
            .flatMap((d) => d.actividades)
            .filter((a) => a.precioEstimado > 0).length
          const isSelected = selected === key

          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={cn(
                'relative flex flex-col rounded-2xl border-2 p-5 text-left transition-all duration-200 hover:-translate-y-1',
                isSelected
                  ? `${meta.ring} bg-surface shadow-[0_18px_40px_-20px_rgba(15,23,42,0.45)]`
                  : 'border-border bg-surface hover:border-border-strong'
              )}
            >
              {meta.popular ? (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-coral-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-[var(--shadow-coral)]">
                  Más elegido
                </span>
              ) : null}
              <div className="mb-3 flex items-center justify-between">
                <span className="text-2xl">{meta.icon}</span>
                {isSelected ? (
                  <span className="grad-brand rounded-full px-2.5 py-0.5 text-xs font-bold text-white">
                    Elegido
                  </span>
                ) : null}
              </div>
              <p className="text-lg font-bold text-fg">{meta.label}</p>
              <p className="mb-3 text-xs text-fg-subtle">{meta.tier}</p>
              <p className="text-2xl font-extrabold text-fg">
                {formatCurrency(trip.presupuestoTotal, moneda)}
              </p>
              <p className="text-sm text-fg-muted">
                {formatCurrency(trip.presupuestoPorPersona, moneda)} / persona
              </p>
              <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3 text-xs text-fg-muted">
                <span>📅 {trip.dias.length} días</span>
                <span>🎯 {actividadesPagadas} actividades de pago</span>
              </div>
            </button>
          )
        })}
      </div>

      <button
        onClick={() => onSelect(selected)}
        className="grad-brand w-full rounded-xl py-3.5 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(20,184,166,0.6)] transition-all hover:-translate-y-0.5 active:scale-[0.99]"
      >
        Ver itinerario {PACKAGE_META[selected].label} →
      </button>
    </div>
  )
}
