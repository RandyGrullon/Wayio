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
            'rounded-lg border-2 p-3 text-center transition-colors',
            value === pkg.value
              ? 'border-blue-600 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          )}
        >
          <p className="font-semibold text-sm">{pkg.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{pkg.desc}</p>
        </button>
      ))}
    </div>
  )
}
