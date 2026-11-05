/**
 * Contrato común de las búsquedas "en tiempo real" (/api/hotels, /api/flights
 * y /api/activities). La forma de la respuesta es SIEMPRE la misma, también en
 * errores (400/429/502), para que la web y la app móvil la traten igual.
 *
 * Los campos opcionales nuevos (startDate, endDate, priceNote, aviso) son
 * compatibles hacia atrás: un cliente antiguo simplemente no los muestra.
 */

/**
 * Proveedor que devolvió el resultado: 'viator' (actividades),
 * 'travelpayouts' (vuelos, datos de Aviasales) y 'liteapi' (hoteles).
 */
export type SearchProvider = 'viator' | 'travelpayouts' | 'liteapi'

export interface SearchResult {
  id: string
  /** Actividad, aerolínea o nombre del hotel. */
  title: string
  subtitle?: string
  /** Precio «desde» (ver `priceNote` para saber a qué corresponde). */
  price?: number
  currency?: string
  /**
   * A qué corresponde el precio, listo para mostrar junto a él: «por persona,
   * ida y vuelta», «total de 3 noches, 2 huéspedes»…
   */
  priceNote?: string
  /**
   * Fechas 'YYYY-MM-DD' a las que corresponde el precio (ida y vuelta, o
   * entrada y salida). Pueden no ser las pedidas: en vuelos, si no hay precios
   * para el día exacto, se dan los más baratos del mes.
   */
  startDate?: string
  endDate?: string
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
 *   hoteles sin su clave en el servidor); se ofrece `enlace` para buscar en
 *   el sitio del socio.
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
  /**
   * Nota para mostrar JUNTO A los resultados (no en lugar de ellos): que los
   * precios son orientativos y pueden cambiar al reservar, fechas cercanas…
   */
  aviso?: string
  /** Enlace de búsqueda en el sitio del socio (afiliado) como alternativa. */
  enlace?: string
}
