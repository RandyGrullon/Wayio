/**
 * Contrato común de las búsquedas "en tiempo real" (/api/hotels, /api/flights
 * y /api/activities). La forma de la respuesta es SIEMPRE la misma, también en
 * errores (400/429/502), para que la web y la app móvil la traten igual.
 */

/** Proveedor que devolvió el resultado. */
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
 * - 'limite': demasiadas búsquedas seguidas (429, ver cabecera Retry-After).
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
  /** Mensaje en español apto para mostrar al usuario cuando no hay resultados. */
  mensaje?: string
  /** Enlace de búsqueda en el sitio del socio (afiliado) como alternativa. */
  enlace?: string
}
