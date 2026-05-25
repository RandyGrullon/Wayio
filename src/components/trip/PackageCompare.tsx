'use client'

import type { Trip } from '@/types/trip'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/formatters'

const PACKAGE_META: Record<
  'basico' | 'confort' | 'premium',
  { label: string; tier: string; color: string; icon: string }
> = {
  basico: {
    label: 'Básico',
    tier: 'Hoteles 3★ · Eco',
    color: 'border-gray-300',
    icon: '🎒',
  },
  confort: {
    label: 'Confort',
    tier: 'Hoteles 4★ · Turista+',
    color: 'border-blue-500',
    icon: '✈️',
  },
  premium: {
    label: 'Premium',
    tier: 'Hoteles 5★ · Business',
    color: 'border-amber-500',
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
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">Elige tu paquete</h2>
        <p className="mt-1 text-sm text-gray-500">
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
                'flex flex-col rounded-xl border-2 p-4 text-left transition-all hover:shadow-md',
                isSelected
                  ? `${meta.color} bg-blue-50 shadow-md`
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-2xl">{meta.icon}</span>
                {isSelected ? (
                  <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                    Seleccionado
                  </span>
                ) : null}
              </div>
              <p className="text-lg font-bold text-gray-900">{meta.label}</p>
              <p className="mb-3 text-xs text-gray-500">{meta.tier}</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(trip.presupuestoTotal, moneda)}
              </p>
              <p className="text-sm text-gray-500">
                {formatCurrency(trip.presupuestoPorPersona, moneda)} / persona
              </p>
              <div className="mt-3 flex flex-col gap-1 text-xs text-gray-600">
                <span>📅 {trip.dias.length} días</span>
                <span>🎯 {actividadesPagadas} actividades de pago</span>
              </div>
            </button>
          )
        })}
      </div>

      <button
        onClick={() => onSelect(selected)}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      >
        Ver itinerario {PACKAGE_META[selected].label} →
      </button>
    </div>
  )
}
