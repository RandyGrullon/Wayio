import type { ActivityType } from '../constants/geofencingRadii'

export type ActivityStatus = 'pendiente' | 'en_curso' | 'completada'

export interface Activity {
  id: string
  nombre: string
  descripcion: string
  lat: number
  lng: number
  tipo: ActivityType
  radioGeofencingMetros: number
  estado: ActivityStatus
  horaInicio?: string
  horaFin?: string
  horaEntrada?: Date
  horaSalida?: Date
  diaIndex: number
  precio?: number
  linkAfiliado?: string
  fotos?: string[]
  puertoCrucero?: boolean
  tiempoEmbarqueMinutos?: number
}

export interface ActivityEvaluation extends Activity {
  estadoCambiado: boolean
}
