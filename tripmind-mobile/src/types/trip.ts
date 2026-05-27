import type { Activity } from './activity'

export type Paquete = 'basico' | 'confort' | 'premium'
export type Moneda = 'USD' | 'EUR' | 'DOP'

export interface Day {
  index: number
  fecha: string
  actividades: Activity[]
}

export interface Trip {
  id: string
  destino: string
  dias: Day[]
  paquete: Paquete
  presupuesto: number
  moneda: Moneda
  isCrucero?: boolean
}
