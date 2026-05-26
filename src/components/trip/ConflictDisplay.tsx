'use client'

import type { Conflict, ConflictSeverity } from '@/types/conflicts'

interface ConflictDisplayProps {
  conflicts: Conflict[]
  onDismiss?: (conflictId: string) => void
}

const SEVERITY_STYLES: Record<
  ConflictSeverity,
  { bg: string; border: string; text: string; badge: string }
> = {
  critico: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-600 text-white',
  },
  advertencia: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    badge: 'bg-amber-500 text-white',
  },
  sugerencia: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    badge: 'bg-blue-500 text-white',
  },
  info: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-700',
    badge: 'bg-gray-400 text-white',
  },
}

const SEVERITY_ORDER: ConflictSeverity[] = [
  'critico',
  'advertencia',
  'sugerencia',
  'info',
]

export function ConflictDisplay({
  conflicts,
  onDismiss,
}: ConflictDisplayProps) {
  if (conflicts.length === 0) return null

  const sorted = [...conflicts].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severidad) - SEVERITY_ORDER.indexOf(b.severidad)
  )

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((conflict) => {
        const s = SEVERITY_STYLES[conflict.severidad]
        return (
          <div
            key={conflict.id}
            className={`rounded-xl border p-3 ${s.bg} ${s.border}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${s.badge}`}
                  >
                    {conflict.severidad}
                  </span>
                  <p className={`text-sm font-semibold ${s.text}`}>
                    {conflict.titulo}
                  </p>
                </div>
                <p className={`mt-1 text-xs ${s.text} opacity-90`}>
                  {conflict.descripcion}
                </p>
                {conflict.actividadesAfectadas.length > 0 ? (
                  <p className="mt-1 text-xs text-gray-500">
                    Afecta:{' '}
                    {conflict.actividadesAfectadas
                      .map((a) => a.nombre)
                      .join(', ')}
                  </p>
                ) : null}
                {conflict.soluciones.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {conflict.soluciones.map((sol, idx) => (
                      <button
                        key={idx}
                        onClick={sol.accion}
                        title={sol.descripcion}
                        className="rounded-lg border border-current px-2 py-1 text-xs font-medium opacity-80 hover:opacity-100"
                      >
                        {sol.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {onDismiss ? (
                <button
                  onClick={() => onDismiss(conflict.id)}
                  className="shrink-0 text-gray-400 hover:text-gray-600"
                >
                  &times;
                </button>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
