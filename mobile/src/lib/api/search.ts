/**
 * Búsqueda en tiempo real (hoteles / actividades / vuelos) contra los mismos
 * endpoints GET que usa `RealSearch` en la web. Envían el Bearer de la sesión
 * si la hay. Contrato común (src/lib/api/types.ts de la web): la respuesta
 * tiene SIEMPRE la misma forma; sin proveedor o sin clave llega
 * `{ configured: false, reason, mensaje, enlace }` en vez de fallar. Los
 * errores HTTP (400/429) llegan como `BackendError` con el `mensaje` del
 * servidor y el cuerpo completo en `error.data`.
 */
import type { Moneda } from '../../types/planning'
import { getJSON } from './http'

export { BackendError } from './http'

/** Proveedor que devolvió el resultado (hoy solo Viator, en actividades). */
export type SearchProvider = 'viator'

export interface SearchResult {
  id: string
  title: string
  subtitle?: string
  price?: number
  currency?: string
  /** Enlace https al producto (con la atribución de afiliado del proveedor). */
  url?: string
  /** Miniatura https, si el proveedor la da. */
  imageUrl?: string
  /** Valoración media (0-5). */
  rating?: number
  reviews?: number
  durationMinutes?: number
  provider: SearchProvider
}

/**
 * Por qué no hay resultados reales:
 * - 'sin-proveedor': ese tipo de búsqueda no tiene proveedor activo (vuelos y
 *   hoteles por ahora); se ofrece `enlace` para buscar en el sitio del socio.
 * - 'no-configurado': hay proveedor, pero falta su clave en el servidor.
 * - 'parametros-invalidos': la petición no pasó la validación (400).
 * - 'limite': demasiadas búsquedas seguidas (429).
 * - 'error-proveedor' / 'tiempo-agotado': el proveedor falló o tardó demasiado.
 */
export type SearchReason =
  | 'sin-proveedor'
  | 'no-configurado'
  | 'parametros-invalidos'
  | 'limite'
  | 'error-proveedor'
  | 'tiempo-agotado'

export interface SearchResponse {
  /** true si hay un proveedor real activo para esta búsqueda. */
  configured: boolean
  results: SearchResult[]
  reason?: SearchReason
  /** Mensaje en español apto para mostrar cuando no hay resultados. */
  mensaje?: string
  /** Enlace de búsqueda en el sitio del socio (afiliado) como alternativa. */
  enlace?: string
}

const enc = encodeURIComponent

/** Viajeros aceptados por el backend (1-20). */
function viajeros(n: number): string {
  return String(Math.min(Math.max(Math.round(n) || 1, 1), 20))
}

/** Hoteles para un destino y rango de fechas (enlace de Booking). */
export function searchHotels(
  destination: string,
  checkIn: string,
  checkOut: string,
  guests: number
): Promise<SearchResponse> {
  return getJSON(
    `/api/hotels?destination=${enc(destination)}&checkIn=${enc(
      checkIn
    )}&checkOut=${enc(checkOut)}&guests=${enc(viajeros(guests))}`
  )
}

/**
 * Actividades reservables para un destino (proveedor: Viator), del día
 * `date` hasta `returnDate` (fin del viaje, opcional), con precios en
 * `currency` (Viator no cobra en DOP: el servidor pasa a USD).
 */
export function searchActivities(
  destination: string,
  date: string,
  { returnDate, currency }: { returnDate?: string; currency?: Moneda } = {}
): Promise<SearchResponse> {
  return getJSON(
    `/api/activities?destination=${enc(destination)}&date=${enc(date)}${
      returnDate ? `&endDate=${enc(returnDate)}` : ''
    }${currency ? `&currency=${enc(currency)}` : ''}`
  )
}

/**
 * Vuelos de ida (`date`) y vuelta (`returnDate`, opcional). `origin` y
 * `destination` aceptan códigos IATA o nombres de ciudad. Hoy no hay
 * proveedor de precios: el backend responde `reason: 'sin-proveedor'` con el
 * `enlace` del buscador del socio. `currency` se envía por simetría con
 * actividades (hoy /api/flights la ignora).
 */
export function searchFlights(
  origin: string,
  destination: string,
  date: string,
  adults: number,
  { returnDate, currency }: { returnDate?: string; currency?: Moneda } = {}
): Promise<SearchResponse> {
  return getJSON(
    `/api/flights?origin=${enc(origin)}&destination=${enc(
      destination
    )}&date=${enc(date)}&adults=${enc(viajeros(adults))}${
      returnDate ? `&returnDate=${enc(returnDate)}` : ''
    }${currency ? `&currency=${enc(currency)}` : ''}`
  )
}
