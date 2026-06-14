import { cn } from '@/lib/utils/cn'
import type { TripForm } from '@/lib/validations/tripForm'

const PACKAGES: {
  value: TripForm['paquete']
  label: string
  desc: string
}[] = [
  { value: 'basico', label: 'Básico', desc: '3★ · Eco · Transporte público' },
  { value: 'confort', label: 'Confort', desc: '4★ · Turista+ · Taxi/Uber' },
  {
    value: 'premium',
    label: 'Premium',
    desc: '5★ · Business · Tours privados',
  },
]

interface PackageSelectorProps {
  value: TripForm['paquete']
  onChange: (type: TripForm['paquete']) => void
}

export function PackageSelector({ value, onChange }: PackageSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {PACKAGES.map((pkg) => (
        <button
          key={pkg.value}
          type="button"
          onClick={() => onChange(pkg.value)}
          className={cn(
            'rounded-xl border p-3 text-center transition-all',
            value === pkg.value
              ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-[0_4px_12px_-4px_rgba(20,184,166,0.5)] dark:bg-brand-500/15 dark:text-brand-300'
              : 'border-border bg-surface text-fg-muted hover:border-brand-300 hover:text-fg'
          )}
        >
          <p className="text-sm font-bold">{pkg.label}</p>
          <p className="mt-0.5 text-xs text-fg-subtle">{pkg.desc}</p>
        </button>
      ))}
    </div>
  )
}
