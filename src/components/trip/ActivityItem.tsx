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

  return (
    <div className="flex flex-col gap-2 rounded-2xl p-3 transition-colors hover:bg-surface-muted">
      <button
        onClick={() => onSelect?.(activity)}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className="flex min-w-[48px] flex-col items-center text-xs font-medium text-fg-muted">
          <span>{activity.horaInicio}</span>
          <span className="text-border-strong">|</span>
          <span>{activity.horaFin}</span>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-fg">{activity.nombre}</p>
          <p className="text-sm text-fg-muted">{activity.direccion}</p>
          {activity.consejos.length > 0 ? (
            <p className="mt-1 text-xs text-fg-subtle">
              {activity.consejos[0]}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="brand">{activity.tipo}</Badge>
          <span className="text-sm font-bold text-fg">
            {formatCurrency(activity.precioEstimado)}
          </span>
          {activity.reservaRequerida ? (
            <span className="text-xs font-medium text-sun-600">
              Reserva req.
            </span>
          ) : null}
        </div>
      </button>

      {hasCoords ? (
        <div className="flex flex-wrap gap-1.5 pl-[60px]">
          <a
            href={nav.google}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: '#4285F4' }}
          >
            Google Maps
          </a>
          <a
            href={nav.waze}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: '#33CCFF', color: '#000' }}
          >
            Waze
          </a>
          <a
            href={nav.apple}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-slate-700 px-2 py-0.5 text-xs font-medium text-white"
          >
            Apple Maps
          </a>
          {activity.linkAfiliado ? (
            <a
              href={activity.linkAfiliado}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white"
            >
              Reservar
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
