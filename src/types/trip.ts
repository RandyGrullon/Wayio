import type { Activity } from '@/types/activity'

export interface Day {
  numero: number
  titulo: string
  descripcion: string
  ciudad: string
  actividades: Activity[]
  presupuestoDia: number
  colorMapa: string
}

export interface Trip {
  id: string
  destino: string
  origen: string
  personas: number
  fechaInicio: string
  fechaFin: string
  presupuestoTotal: number
  presupuestoPorPersona: number
  dias: Day[]
  paquete: 'basico' | 'confort' | 'premium'
  /**
   * Moneda de todos los importes del viaje. Opcional por compatibilidad con
   * viajes guardados antes de existir el campo (se asume USD).
   */
  moneda?: 'USD' | 'EUR' | 'DOP'
  /**
   * Estimación de la IA del vuelo ida y vuelta por persona desde el origen (en
   * `moneda`). No está incluida en presupuestoTotal (que es el gasto en
   * destino). 0 si no hace falta volar.
   */
  vueloEstimadoPorPersona?: number
  resumenViaje: string
  consejos: string[]
  advertencias: string[]
  listaActividades: string[]
  actividadesPendientes: Activity[]
}

export interface TripPackage {
  type: 'budget' | 'standard' | 'premium' | 'luxury'
  label: string
  priceMultiplier: number
}
