import { MapPin, Ticket } from 'lucide-react'
import type { Activity } from '@/types/activity'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils/formatters'
import { buildNavigationLinks } from '@/constants/affiliateLinks'

interface ActivityItemProps {
  activity: Activity
  onSelect?: (activity: Activity) => void
}

export function ActivityItem({ activity, onSelect }: ActivityItemProps) {
  const nav = buildNavigationLinks(activity.lat, activity.lng)
  const hasCoords = activity.lat !== 0 || activity.lng !== 0
  const canReserve = activity.reservaRequerida && Boolean(activity.linkAfiliado)

  return (
    <div className="group flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-surface-muted">
      {/* Time rail */}
      <div className="flex min-w-[44px] flex-col items-center pt-0.5 text-xs font-medium text-fg-muted">
        <span>{activity.horaInicio}</span>
        <span className="my-0.5 h-3 w-px bg-border-strong" />
        <span>{activity.horaFin}</span>
      </div>

      {/* Body — clicking marks the activity (e.g. as lost) when enabled */}
      <button
        onClick={() => onSelect?.(activity)}
        disabled={!onSelect}
        className="flex-1 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold leading-tight text-fg">
            {activity.nombre}
          </p>
          <span className="shrink-0 text-sm font-bold text-fg">
            {formatCurrency(activity.precioEstimado)}
          </span>
        </div>
        {activity.direccion ? (
          <p className="mt-0.5 truncate text-sm text-fg-muted">
            {activity.direccion}
          </p>
        ) : null}
      </button>

      {/* Minimal actions: one nav link + reserve only when truly needed */}
      <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
        <Badge variant="brand">{activity.tipo}</Badge>
        <div className="flex items-center gap-2">
          {hasCoords ? (
            <a
              href={nav.google}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-fg-subtle transition-colors hover:text-brand-600"
              title="Cómo llegar"
            >
              <MapPin className="h-3.5 w-3.5" />
              Llegar
            </a>
          ) : null}
          {canReserve ? (
            <a
              href={activity.linkAfiliado}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              <Ticket className="h-3.5 w-3.5" />
              Reservar
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
