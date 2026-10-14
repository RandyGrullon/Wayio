/**
 * Instrumentación del navegador (Next 16: se ejecuta tras cargar el HTML y
 * antes de hidratar React).
 *
 * - Sentry: errores del navegador y trazas de navegación. Sin
 *   NEXT_PUBLIC_SENTRY_DSN queda desactivado.
 * - PostHog: analítica de producto. Sin NEXT_PUBLIC_POSTHOG_KEY no hace nada.
 *
 * Cada bloque va en try/catch: un fallo de monitorización nunca debe impedir
 * que la app arranque.
 */
import * as Sentry from '@sentry/nextjs'
import { initPostHog } from '@/lib/analytics/client'
import { sanearUrls } from '@/lib/analytics/sanitize'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()
const esProduccion = process.env.NODE_ENV === 'production'

try {
  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
      // Muestreo bajo de trazas para no gastar la cuota gratuita.
      tracesSampleRate: esProduccion ? 0.05 : 0,
      sendDefaultPii: false,
      // Sin tokens de enlaces de email ni códigos OAuth en las URLs.
      beforeSend: (evento) => sanearUrls(evento),
      beforeSendTransaction: (evento) => sanearUrls(evento),
      beforeBreadcrumb: (miga) => sanearUrls(miga),
    })
  }
} catch {
  /* sin monitorización de errores, pero la app sigue */
}

try {
  initPostHog()
} catch {
  /* sin analítica, pero la app sigue */
}

/** Marca el inicio de cada navegación del App Router para las trazas. */
export function onRouterTransitionStart(
  href: string,
  navigationType: 'push' | 'replace' | 'traverse'
): void {
  if (!dsn) return
  try {
    Sentry.captureRouterTransitionStart(href, navigationType)
  } catch {
    /* ignorado */
  }
}
