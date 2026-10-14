/**
 * Catálogo tipado de eventos de analítica de producto (PostHog).
 *
 * Lo comparten el cliente (`track` en events.ts) y el servidor
 * (`trackServerEvent` en posthog.ts). Las propiedades opcionales admiten
 * `undefined` explícito para que la UI pueda pasar valores que quizá no tenga.
 *
 * Privacidad: nunca mandes emails, nombres ni textos libres del usuario como
 * propiedades; usa ids, conteos y categorías.
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
  | 'otro'

/** Qué se estaba buscando al pulsar el enlace de afiliado. */
export type CategoriaAfiliado =
  | 'vuelo'
  | 'hotel'
  | 'actividad'
  | 'carro'
  | 'esim'

/** Propiedades heredadas (eventos antiguos que aún emite parte de la UI). */
export type LegacyProps = Record<
  string,
  string | number | boolean | null | undefined
>

export interface AnalyticsEventProps {
  /** Se mostró un itinerario generado (o el demo) al usuario. */
  itinerario_generado: {
    destino: string
    dias: number
    personas?: number | undefined
    tipo?: string | undefined
    paquete?: 'basico' | 'confort' | 'premium' | undefined
    moneda?: string | undefined
    /** true si vino de la caché de viajes. */
    desdeCache?: boolean | undefined
    /** true si es el itinerario de demostración (sin IA configurada). */
    demo?: boolean | undefined
    duracionMs?: number | undefined
  }
  /** El usuario guardó un viaje en su cuenta. */
  viaje_guardado: {
    tripId: string
    destino: string
    dias?: number | undefined
  }
  /** El usuario compartió un viaje (enlace, menú nativo, grupo…). */
  viaje_compartido: {
    tripId: string
    metodo: 'enlace' | 'nativo' | 'whatsapp' | 'grupo' | 'otro'
  }
  /** Clic en un enlace de afiliado (vuelos, hoteles, actividades…). */
  click_afiliado: {
    proveedor: ProveedorAfiliado
    categoria: CategoriaAfiliado
    destino?: string | undefined
    tripId?: string | undefined
    /** Dónde estaba el enlace (p. ej. 'essentials', 'actividad', 'mapa'). */
    ubicacion?: string | undefined
  }
  /** Se abrió un checkout de Stripe (plan o reserva). */
  checkout_iniciado: {
    tipo: 'plan' | 'reserva'
    planId?: string | undefined
    moneda?: string | undefined
    tripId?: string | undefined
  }
  /** Se usó la interpretación con IA de texto libre, video o imagen. */
  interpretacion_usada: {
    fuente: 'texto' | 'video' | 'imagen' | 'enlace'
    exito: boolean
    /** Cuántos campos del formulario se rellenaron automáticamente. */
    camposDetectados?: number | undefined
  }

  // Eventos heredados, mantenidos por compatibilidad con la UI actual.
  trip_generated: LegacyProps
  trip_shared: LegacyProps
  booking_click: LegacyProps
  pro_paywall_shown: LegacyProps
  pro_converted: LegacyProps
  alert_shown: LegacyProps
  alert_accepted: LegacyProps
  activity_completed: LegacyProps
  activity_lost: LegacyProps
  activity_rescheduled: LegacyProps
  tiktok_analyzed: LegacyProps
  referral_created: LegacyProps
  referral_converted: LegacyProps
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

/** Eventos que se emiten desde el servidor (webhooks, referidos…). */
export type ServerAnalyticsEvent =
  | 'pro_converted'
  | 'checkout_completado'
  | 'suscripcion_cancelada'
  | 'reserva_pagada'
  | 'referral_created'
  | 'referral_converted'
  | 'itinerario_generado'
