import type { Trip } from '@/types/trip'
import { formatPorcentaje } from '@/lib/utils/formatters'
import { NIVELES, type NivelMeta } from './catalogo'
import type { Paquete } from './borrador'

/**
 * Cálculos de la pantalla de versiones (docs/DISENO.md §6.4): encaje con el
 * presupuesto, filas comparables y «Lo que la hace distinta».
 */

export type TonoEncaje = 'success' | 'warning' | 'danger'

export interface Encaje {
  /** Porcentaje del presupuesto (0–∞). */
  pct: number
  tono: TonoEncaje
  texto: string
}

/** ≤100 % dentro · 100–115 % un poco por encima · >115 % por encima. */
export function encajeDe(
  total: number,
  presupuesto: number | null | undefined
): Encaje | null {
  if (!presupuesto || presupuesto <= 0 || !Number.isFinite(total)) return null
  const pct = Math.round((total / presupuesto) * 100)
  const p = formatPorcentaje(pct)
  if (pct <= 100)
    return { pct, tono: 'success', texto: `Dentro de tu presupuesto (${p})` }
  if (pct <= 115)
    return { pct, tono: 'warning', texto: `Un poco por encima (${p})` }
  return { pct, tono: 'danger', texto: `Por encima de tu presupuesto (${p})` }
}

const CHECK_IN = /^check-?in\s+(?:en|at)\s+(.+)$/i

/** Hoteles del viaje (de las actividades «Check-in en <hotel>»). */
export function hotelesDe(trip: Trip): string[] {
  const nombres = trip.dias.flatMap((d) =>
    d.actividades.flatMap((a) => {
      const m = CHECK_IN.exec(a.nombre.trim())
      return m?.[1] ? [m[1].trim()] : []
    })
  )
  return Array.from(new Set(nombres))
}

export interface FilasVersion {
  dias: number
  actividades: number
  dePago: number
  hospedaje: string
  transporte: string
  ritmo: number
}

export function filasDe(trip: Trip, tier: Paquete): FilasVersion {
  const meta: NivelMeta = NIVELES[tier]
  const acts = trip.dias.flatMap((d) =>
    d.actividades.filter(
      (a) => a.tipo !== 'traslado' && !CHECK_IN.test(a.nombre)
    )
  )
  const hoteles = hotelesDe(trip)
  const primero = hoteles[0]
  const hospedaje = !primero
    ? meta.hoteles
    : hoteles.length === 1
      ? primero
      : `${primero} y ${hoteles.length - 1} más`
  const dias = Math.max(1, trip.dias.length)
  return {
    dias: trip.dias.length,
    actividades: acts.length,
    dePago: acts.filter((a) => a.precioEstimado > 0).length,
    hospedaje,
    transporte: meta.transporte,
    ritmo: Math.round(acts.length / dias),
  }
}

/**
 * Hasta `max` rasgos de la versión frente a otra: hospedaje y experiencias
 * que cambian (mismos ids en los tres paquetes, distinto contenido).
 */
export function diferenciasDe(
  trip: Trip,
  tier: Paquete,
  referencia: Trip | null,
  max = 3
): string[] {
  const rasgos: string[] = []
  const hoteles = hotelesDe(trip)
  const hotelesRef = referencia ? hotelesDe(referencia) : []
  const hotel = hoteles[0]
  if (hotel && hotel !== hotelesRef[0]) rasgos.push(`Duermes en ${hotel}`)

  if (referencia) {
    const porId = new Map(
      referencia.dias.flatMap((d) =>
        d.actividades.map((a) => [a.id, a] as const)
      )
    )
    for (const dia of trip.dias) {
      for (const a of dia.actividades) {
        if (rasgos.length >= max) break
        if (a.tipo === 'traslado' || CHECK_IN.test(a.nombre)) continue
        const otra = porId.get(a.id)
        if (otra && otra.nombre.trim() !== a.nombre.trim()) {
          rasgos.push(`${a.nombre} (día ${dia.numero})`)
        }
      }
    }
  }
  if (rasgos.length === 0) rasgos.push(NIVELES[tier].rasgo)
  return rasgos.slice(0, max)
}

/** Versión con la que se compara cada una para «Lo que la hace distinta». */
export function referenciaDe(tier: Paquete): Paquete {
  return tier === 'confort' ? 'basico' : 'confort'
}
