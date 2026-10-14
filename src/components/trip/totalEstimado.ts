import type { Trip } from '@/types/trip'
import {
  contarDias,
  contarNoches,
  formatPorcentaje,
} from '@/lib/utils/formatters'
import { esCheckIn, monedaDelViaje } from './tripUtils'
import type { MonedaViaje } from './tripUtils'

/**
 * El TOTAL ESTIMADO único del viaje (docs/DISENO.md §6.5, «Completa tu
 * viaje»). Es el mismo número en la franja de datos y en la tarjeta de total.
 *
 * - Plan: presupuestoTotal (gasto en destino) sin el hospedaje.
 * - Hospedaje: la suma de las actividades «Check-in en <hotel>», que la IA ya
 *   incluye en el plan con el coste de las noches. Se puede quitar si el
 *   viajero ya tiene dónde dormir.
 * - Vuelo: vueloEstimadoPorPersona × personas (no está en presupuestoTotal).
 * - Carro: estimación orientativa por día según la versión del viaje.
 */

export interface SeleccionExtras {
  vuelo: boolean
  hospedaje: boolean
  carro: boolean
}

export type TonoEncaje = 'success' | 'warning' | 'danger'

export interface Encaje {
  porcentaje: number
  tono: TonoEncaje
  texto: string
}

export interface DesgloseTotal {
  moneda: MonedaViaje
  personas: number
  dias: number
  noches: number
  /** Gasto en destino sin el hospedaje. */
  plan: number
  /** Hospedaje incluido por la IA (check-ins); 0 si no hay. */
  hospedaje: number
  hospedajeIncluido: boolean
  /** Nombres de los hoteles del plan. */
  hoteles: string[]
  /** null = sin estimación (viajes antiguos); 0 = no hace falta volar. */
  vuelo: number | null
  vueloPorPersona: number | null
  carro: number
  seleccion: SeleccionExtras
  /** Partidas que suman al total, en orden de la barra apilada. */
  partidas: Array<{
    clave: 'plan' | 'vuelo' | 'hospedaje' | 'carro'
    etiqueta: string
    valor: number
  }>
  total: number
  porPersona: number
  encaje: Encaje | null
}

// Alquiler de carro por día, en USD, según la versión (orientativo).
const CARRO_DIA_USD: Record<Trip['paquete'], number> = {
  basico: 35,
  confort: 55,
  premium: 95,
}
// Conversión aproximada solo para esta estimación orientativa.
const APROX_POR_USD: Record<MonedaViaje, number> = {
  USD: 1,
  EUR: 0.92,
  DOP: 60,
}

function redondear(n: number, moneda: MonedaViaje): number {
  const paso = moneda === 'DOP' ? 100 : 5
  return Math.round(n / paso) * paso
}

/** Selección por defecto: vuelo si hace falta, hospedaje incluido, sin carro. */
export function seleccionInicial(trip: Trip): SeleccionExtras {
  return {
    vuelo: (trip.vueloEstimadoPorPersona ?? 0) > 0,
    hospedaje: true,
    carro: false,
  }
}

/** Encaje del total con el presupuesto (siempre con texto, nunca solo color). */
export function calcularEncaje(
  total: number,
  presupuesto: number
): Encaje | null {
  if (!Number.isFinite(presupuesto) || presupuesto <= 0) return null
  const porcentaje = Math.round((total / presupuesto) * 100)
  const pct = formatPorcentaje(porcentaje)
  if (porcentaje <= 100) {
    return {
      porcentaje,
      tono: 'success',
      texto: `Dentro de tu presupuesto (${pct})`,
    }
  }
  if (porcentaje <= 115) {
    return { porcentaje, tono: 'warning', texto: `Un poco por encima (${pct})` }
  }
  return {
    porcentaje,
    tono: 'danger',
    texto: `Por encima de tu presupuesto (${pct})`,
  }
}

export function calcularTotal(
  trip: Trip,
  seleccion: SeleccionExtras,
  presupuesto?: { monto: number; moneda?: string | undefined } | null
): DesgloseTotal {
  const moneda = monedaDelViaje(trip)
  const personas = Math.max(1, Math.round(trip.personas || 1))
  const dias = Math.max(
    1,
    contarDias(trip.fechaInicio, trip.fechaFin) || trip.dias.length
  )
  const noches = contarNoches(trip.fechaInicio, trip.fechaFin)

  const checkIns = trip.dias.flatMap((d) => d.actividades.filter(esCheckIn))
  const hospedaje = Math.max(
    0,
    checkIns.reduce((s, a) => s + (Number(a.precioEstimado) || 0), 0)
  )
  const hoteles = checkIns
    .map((a) => a.nombre.replace(/^\s*check-?in\s*(en|:)?\s*/i, '').trim())
    .filter(Boolean)
  const gastoDestino = Math.max(0, Number(trip.presupuestoTotal) || 0)
  const plan = Math.max(0, gastoDestino - Math.min(hospedaje, gastoDestino))
  const hospedajeIncluido = checkIns.length > 0 && hospedaje > 0

  const vueloPorPersona =
    typeof trip.vueloEstimadoPorPersona === 'number' &&
    Number.isFinite(trip.vueloEstimadoPorPersona)
      ? Math.max(0, trip.vueloEstimadoPorPersona)
      : null
  const vuelo = vueloPorPersona === null ? null : vueloPorPersona * personas
  const carro = redondear(
    CARRO_DIA_USD[trip.paquete] * APROX_POR_USD[moneda] * dias,
    moneda
  )

  const partidas: DesgloseTotal['partidas'] = [
    { clave: 'plan', etiqueta: 'Plan en destino', valor: plan },
  ]
  if (seleccion.vuelo && vuelo !== null && vuelo > 0) {
    partidas.push({ clave: 'vuelo', etiqueta: 'Vuelo', valor: vuelo })
  }
  if (seleccion.hospedaje && hospedajeIncluido) {
    partidas.push({
      clave: 'hospedaje',
      etiqueta: 'Hospedaje',
      valor: hospedaje,
    })
  }
  if (seleccion.carro) {
    partidas.push({ clave: 'carro', etiqueta: 'Carro', valor: carro })
  }
  const total = partidas.reduce((s, p) => s + p.valor, 0)
  const mismaMoneda =
    !presupuesto?.moneda || presupuesto.moneda.toUpperCase() === moneda

  return {
    moneda,
    personas,
    dias,
    noches,
    plan,
    hospedaje,
    hospedajeIncluido,
    hoteles,
    vuelo,
    vueloPorPersona,
    carro,
    seleccion,
    partidas,
    total,
    porPersona: Math.round(total / personas),
    encaje:
      presupuesto && mismaMoneda
        ? calcularEncaje(total, presupuesto.monto)
        : null,
  }
}
