export interface UserLocation {
  lat: number
  lng: number
  accuracy: number
  timestamp: Date
}

export interface GeofenceEvent {
  activityId: string
  activityNombre: string
  type: 'enter' | 'exit'
  timestamp: Date
}
