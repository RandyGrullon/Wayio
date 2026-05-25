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
    <div className="flex flex-col gap-2 rounded-lg p-3 hover:bg-gray-50">
      <button
        onClick={() => onSelect?.(activity)}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className="flex flex-col items-center text-xs text-gray-500 min-w-[48px]">
          <span>{activity.horaInicio}</span>
          <span className="text-gray-300">|</span>
          <span>{activity.horaFin}</span>
        </div>
        <div className="flex-1">
          <p className="font-medium text-gray-900">{activity.nombre}</p>
          <p className="text-sm text-gray-500">{activity.direccion}</p>
          {activity.consejos.length > 0 ? (
            <p className="mt-1 text-xs text-gray-400">{activity.consejos[0]}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="info">{activity.tipo}</Badge>
          <span className="text-sm font-medium text-gray-700">
            {formatCurrency(activity.precioEstimado)}
          </span>
          {activity.reservaRequerida ? (
            <span className="text-xs text-amber-600">Reserva req.</span>
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
            className="rounded bg-gray-700 px-2 py-0.5 text-xs font-medium text-white"
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
