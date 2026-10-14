'use client'

import posthog from 'posthog-js'
import { sanearUrls } from './sanitize'

/**
 * PostHog en el navegador. Todo es no-op si falta NEXT_PUBLIC_POSTHOG_KEY y
 * nada lanza excepciones: la analítica nunca debe romper la app.
 *
 * Se inicializa en src/instrumentation-client.ts (antes de la hidratación) y,
 * por si acaso, también desde PostHogProvider; initPostHog es idempotente.
 */

const DEFAULT_HOST = 'https://us.i.posthog.com'

// Acceso con punto para que Next incruste las NEXT_PUBLIC_* en el bundle.
function clave(): string | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
  return key ? key : null
}

function host(): string {
  const h = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim()
  return h ? h : DEFAULT_HOST
}

let iniciado = false

/** Inicializa PostHog una sola vez (solo en el navegador y con key). */
export function initPostHog(): void {
  if (iniciado || typeof window === 'undefined') return
  const key = clave()
  if (!key) return
  iniciado = true
  try {
    posthog.init(key, {
      api_host: host(),
      // Pageview en la carga inicial y en cada cambio de ruta del App Router.
      capture_pageview: 'history_change',
      capture_pageleave: true,
      persistence: 'localStorage',
      // Solo creamos perfiles de personas que inician sesión.
      person_profiles: 'identified_only',
      respect_dnt: true,
      // Sin grabación de sesiones: podrían capturar datos personales.
      disable_session_recording: true,
      // Las URLs de algunas páginas llevan credenciales (p. ej.
      // /auth/abrir-app?token_hash=…): se enmascaran en $current_url, en el
      // href de los clics autocapturados y en las propiedades de persona.
      before_send: (evento) => sanearUrls(evento),
    })
  } catch {
    iniciado = false
  }
}

/** ¿PostHog está listo para recibir eventos? */
export function analyticsReady(): boolean {
  try {
    return iniciado && posthog.__loaded
  } catch {
    return false
  }
}

/** Asocia los eventos siguientes al usuario con sesión (solo su id). */
export function identifyUser(userId: string): void {
  if (!analyticsReady() || !userId) return
  try {
    if (posthog.get_distinct_id() !== userId) posthog.identify(userId)
  } catch {
    /* la analítica nunca rompe la app */
  }
}

/**
 * Olvida la identidad actual (al cerrar sesión), para que el siguiente usuario
 * del dispositivo no herede el id del anterior.
 */
export function resetAnalytics(): void {
  if (!analyticsReady()) return
  try {
    posthog.reset()
  } catch {
    /* la analítica nunca rompe la app */
  }
}

/** Captura cruda (la usa `track`, que es la API tipada). */
export function captureClient(
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!analyticsReady()) return
  try {
    posthog.capture(event, properties)
  } catch {
    /* la analítica nunca rompe la app */
  }
}

export { posthog }
