import type { Activity } from '@/types/activity'

export type ConflictType =
  | 'overlap_horario'
  | 'tiempo_traslado_insuficiente'
  | 'lugar_cerrado'
  | 'presupuesto_excedido'
  | 'embarque_crucero'
  | 'reserva_requerida'
  | 'actividad_perdida_sin_reagendar'
  | 'ruta_ineficiente'
  | 'hora_inadecuada'

export type ConflictSeverity = 'critico' | 'advertencia' | 'sugerencia' | 'info'

export interface Solucion {
  label: string
  descripcion: string
  accion: () => void
}

export interface Conflict {
  id: string
  tipo: ConflictType
  severidad: ConflictSeverity
  titulo: string
  descripcion: string
  actividadesAfectadas: Activity[]
  soluciones: Solucion[]
}
