/**
 * Catálogo tipado de eventos de analítica de producto (PostHog) de la app.
 * Mismos nombres y propiedades que la web (src/lib/analytics/types.ts), para
 * que los eventos de las dos plataformas se lean juntos en PostHog.
 *
 * Privacidad: nunca mandes emails, nombres ni textos libres del usuario como
 * propiedades; usa ids, conteos y categorías. Tampoco URLs (pueden llevar
 * credenciales o IDs de afiliado).
 */

/** Proveedor del enlace de afiliado pulsado. */
export type ProveedorAfiliado =
  | 'booking'
  | 'booking_cars'
  | 'viator'
  | 'skyscanner'
  | 'google_flights'
  | 'aviasales'
  | 'airalo'
  | 'tripcom'
  | 'civitatis'
  | 'getyourguide'
  | 'discovercars'
  | 'iati'
  | 'otro'

/** Qué se estaba buscando al pulsar el enlace de afiliado. */
export type CategoriaAfiliado =
  | 'vuelo'
  | 'hotel'
  | 'actividad'
  | 'carro'
  | 'esim'
  | 'seguro'

export interface AnalyticsEventProps {
  /** Clic en un enlace de afiliado (vuelos, hoteles, actividades…). */
  click_afiliado: {
    proveedor: ProveedorAfiliado
    categoria: CategoriaAfiliado
    destino?: string | undefined
    tripId?: string | undefined
    /**
     * Dónde estaba el enlace: 'actividad', 'completa-tu-viaje' o
     * 'disponibilidad-real' (los mismos valores que la web).
     */
    ubicacion?: string | undefined
  }
}

export type AnalyticsEvent = keyof AnalyticsEventProps

/**
 * Argumentos de propiedades de `track`: obligatorios si el evento tiene alguna
 * propiedad requerida, opcionales si todas lo son.
 */
export type TrackArgs<E extends AnalyticsEvent> =
  Record<string, never> extends AnalyticsEventProps[E]
    ? [properties?: AnalyticsEventProps[E]]
    : [properties: AnalyticsEventProps[E]]
