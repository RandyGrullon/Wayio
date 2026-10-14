import type { Activity } from '@/types/activity'
import { haversineKm } from './normalize'

/**
 * Estimación de tiempos de traslado entre actividades consecutivas sin APIs de
 * pago: distancia en línea recta × factor de rodeo, a pie si es corto y en
 * transporte urbano si es largo. Sustituye a Google Distance Matrix (API
 * legacy que ya no se puede activar en proyectos nuevos).
 *
 * Solo corrige el valor de la IA cuando ambas actividades tienen coordenadas
 * verificadas y el valor de la IA es claramente irreal; si no, conserva el de
 * la IA (que conoce el medio de transporte previsto).
 */

const RODEO = 1.3
const KMH_PIE = 4.5
const KMH_URBANO = 22
const ESPERA_URBANO_MIN = 8

export function estimarMinutos(km: number): number {
  const real = km * RODEO
  if (real <= 1.4) return Math.max(3, Math.round((real / KMH_PIE) * 60))
  return Math.round((real / KMH_URBANO) * 60 + ESPERA_URBANO_MIN)
}

export function ajustarTiemposTraslado(acts: Activity[]): Activity[] {
  return acts.map((a, i) => {
    const sig = acts[i + 1]
    if (!sig) return { ...a, tiempoHastaSiguiente: 0 }
    const conCoords =
      a.coordsVerificadas &&
      sig.coordsVerificadas &&
      !(a.lat === 0 && a.lng === 0) &&
      !(sig.lat === 0 && sig.lng === 0)
    if (!conCoords) return a
    const estimado = estimarMinutos(haversineKm(a, sig))
    const ia = a.tiempoHastaSiguiente
    // Solo corregimos si la IA se aleja más de x2 de la estimación física.
    const irreal =
      ia <= 0 || ia > estimado * 2.5 + 15 || ia * 2.5 + 10 < estimado
    return irreal ? { ...a, tiempoHastaSiguiente: estimado } : a
  })
}
