import type { AlertLevel } from '../../types/alert'

export function calculateAlertLevel(
  retrasoMinutos: number,
  esCrucero: boolean,
  minutosParaEmbarque?: number
): AlertLevel {
  if (esCrucero && minutosParaEmbarque !== undefined) {
    if (minutosParaEmbarque <= 90) return 5
    if (minutosParaEmbarque <= 120) return 4
  }

  if (retrasoMinutos <= 0) return 0
  if (retrasoMinutos <= 15) return 1
  if (retrasoMinutos <= 30) return 2
  if (retrasoMinutos <= 50) return 3
  if (retrasoMinutos <= 75) return 4
  return 5
}

export function calcularRetrasoMinutos(
  horaInicioPlaneada: string,
  ahora: Date
): number {
  const [h, m] = horaInicioPlaneada.split(':').map(Number)
  const planeada = new Date(ahora)
  planeada.setHours(h ?? 0, m ?? 0, 0, 0)
  return Math.floor((ahora.getTime() - planeada.getTime()) / 60000)
}

export function minutosParaEmbarque(horaEmbarque: string, ahora: Date): number {
  const [h, m] = horaEmbarque.split(':').map(Number)
  const embarque = new Date(ahora)
  embarque.setHours(h ?? 0, m ?? 0, 0, 0)
  return Math.floor((embarque.getTime() - ahora.getTime()) / 60000)
}
