export type AlertLevel = 0 | 1 | 2 | 3 | 4 | 5

export interface AlertMessage {
  mensajeAmigable: string
  actividadRecomendarQuitar: string | null
  razonSimple: string
  tiempoQueAhorra: number
  alternativa: string | null
}

export interface AlertState {
  level: AlertLevel
  retrasoMinutos: number
  actividadActualId: string | null
  aiMessage: AlertMessage | null
  aiLoading: boolean
  dismissed: boolean
  lastUpdated: number
}

export interface RescheduleOption {
  dia: number
  posicion: number
  impactoMinutos: number
  descripcion: string
  esOptima: boolean
}
