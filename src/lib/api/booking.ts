import { buildBookingLink } from '@/constants/affiliateLinks'
import type { SearchResponse } from './types'

/**
 * Hoteles: sin proveedor de precios en tiempo real.
 *
 * La API antigua de Booking (distribution-xml 2.9) está retirada y la actual
 * (Demand API) solo se da a socios con contrato, así que no se llama a nada:
 * se devuelve el enlace de búsqueda de afiliado para que el usuario vea
 * disponibilidad y precios en Booking.com.
 */

export interface HotelSearchParams {
  destino: string
  checkIn: string
  checkOut: string
  huespedes: number
}

export const MENSAJE_HOTELES_SIN_PROVEEDOR =
  'Los precios de hoteles se consultan directamente en Booking.com, con tus fechas ya puestas.'

/** 'YYYY-MM-DD' del día siguiente (UTC). */
function diaSiguiente(fecha: string): string {
  const t = Date.parse(`${fecha}T00:00:00Z`)
  if (!Number.isFinite(t)) return fecha
  return new Date(t + 86_400_000).toISOString().slice(0, 10)
}

export function searchHotels(p: HotelSearchParams): SearchResponse {
  // Viaje de un solo día (salida = regreso): se busca una noche.
  const checkOut = p.checkOut > p.checkIn ? p.checkOut : diaSiguiente(p.checkIn)
  return {
    configured: false,
    results: [],
    reason: 'sin-proveedor',
    mensaje: MENSAJE_HOTELES_SIN_PROVEEDOR,
    enlace: buildBookingLink(p.destino, p.checkIn, {
      checkOut,
      adultos: p.huespedes,
    }),
  }
}
