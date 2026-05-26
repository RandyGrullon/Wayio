export type ActivityType =
  | 'museo'
  | 'restaurante'
  | 'templo'
  | 'parque'
  | 'barrio'
  | 'playa'
  | 'actividad'
  | 'traslado'

export interface Activity {
  id: string
  nombre: string
  descripcion: string
  horaInicio: string
  horaFin: string
  duracionMinutos: number
  tipo: ActivityType
  direccion: string
  lat: number
  lng: number
  radioGeofencingMetros: number
  precioEstimado: number
  reservaRequerida: boolean
  reservaPagada: boolean
  mejorHoraVisita: string
  consejos: string[]
  linkAfiliado?: string
  tiempoHastaSiguiente: number
  estado: 'pendiente' | 'en_curso' | 'completada' | 'perdida' | 'recuperada'
  esPerdida: boolean
  reagendadaDesdeDia?: number
  tiempoEmbarqueMinutos?: number
  puertoCrucero?: boolean
}
