import MapboxGL from '@rnmapbox/maps'
import type { ActivityEvaluation } from '../types/activity'

const STATUS_COLORS: Record<ActivityEvaluation['estado'], string> = {
  pendiente: '#6B7280',
  en_curso: '#2563EB',
  completada: '#16A34A',
  perdida: '#DC2626',
}

interface Props {
  activity: ActivityEvaluation
  index: number
}

export function GeofenceCircle({ activity, index }: Props): React.ReactElement {
  const color = STATUS_COLORS[activity.estado]
  const pinSymbol = activity.puertoCrucero ? '⚓' : String(index + 1)

  return (
    <>
      <MapboxGL.CircleLayer
        id={`geofence-fill-${activity.id}`}
        style={{
          circleRadius: activity.radioGeofencingMetros / 10,
          circleColor: color,
          circleOpacity: 0.12,
          circleStrokeColor: color,
          circleStrokeWidth: 1.5,
          circleStrokeOpacity: 0.5,
        }}
      />
      <MapboxGL.SymbolLayer
        id={`geofence-label-${activity.id}`}
        style={{
          textField: `${pinSymbol} ${activity.nombre}`,
          textSize: 12,
          textColor: color,
          textHaloColor: '#FFFFFF',
          textHaloWidth: 2,
          textOffset: [0, 1.5],
          textAnchor: 'top',
        }}
      />
    </>
  )
}
