import type { Activity, ActivityEvaluation } from '../../types/activity'

export class GeofenceDetector {
  isInsideRadius(
    userLat: number,
    userLng: number,
    actLat: number,
    actLng: number,
    radioMetros: number
  ): boolean {
    const distancia = this.haversineDistance(userLat, userLng, actLat, actLng)
    return distancia <= radioMetros
  }

  haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  evaluateActivities(
    userLat: number,
    userLng: number,
    activities: Activity[]
  ): ActivityEvaluation[] {
    return activities.map((activity) => {
      const dentroDelRadio = this.isInsideRadius(
        userLat,
        userLng,
        activity.lat,
        activity.lng,
        activity.radioGeofencingMetros
      )

      if (dentroDelRadio && activity.estado === 'pendiente') {
        return {
          ...activity,
          estado: 'en_curso' as const,
          horaEntrada: new Date(),
          estadoCambiado: true,
        }
      }

      if (!dentroDelRadio && activity.estado === 'en_curso') {
        return {
          ...activity,
          estado: 'completada' as const,
          horaSalida: new Date(),
          estadoCambiado: true,
        }
      }

      return { ...activity, estadoCambiado: false }
    })
  }
}

export const geofenceDetector = new GeofenceDetector()
