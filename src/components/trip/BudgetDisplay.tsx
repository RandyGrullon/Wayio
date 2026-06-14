import type { Day } from '@/types/trip'
import { formatCurrency } from '@/lib/utils/formatters'

interface BudgetDisplayProps {
  dias: Day[]
  currency?: string
  totalBudget: number
}

export function BudgetDisplay({
  dias,
  currency = 'USD',
  totalBudget,
}: BudgetDisplayProps) {
  const spent = dias
    .flatMap((d) => d.actividades)
    .reduce((sum, a) => sum + a.precioEstimado, 0)

  const remaining = totalBudget - spent
  const percentage = Math.min((spent / totalBudget) * 100, 100)

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-2 flex justify-between text-sm text-fg-muted">
        <span>Gastado: {formatCurrency(spent, currency)}</span>
        <span>Presupuesto: {formatCurrency(totalBudget, currency)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${remaining < 0 ? 'bg-red-500' : 'grad-brand'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p
        className={`mt-2 text-sm font-medium ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}
      >
        {remaining >= 0
          ? `${formatCurrency(remaining, currency)} restante`
          : `${formatCurrency(-remaining, currency)} sobre presupuesto`}
      </p>
    </div>
  )
}
