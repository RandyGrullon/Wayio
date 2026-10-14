import * as Sentry from '@sentry/nextjs'
import { sanearUrls } from '@/lib/analytics/sanitize'

/**
 * Instrumentación del servidor (Node y Edge). Sin DSN, Sentry no se
 * inicializa y onRequestError no hace nada.
 *
 * El DSN es público (no es un secreto), así que se acepta tanto SENTRY_DSN
 * como NEXT_PUBLIC_SENTRY_DSN para no tener que duplicarlo.
 */
function sentryDsn(): string | undefined {
  const dsn =
    process.env['SENTRY_DSN']?.trim() ||
    process.env['NEXT_PUBLIC_SENTRY_DSN']?.trim()
  return dsn ? dsn : undefined
}

export async function register(): Promise<void> {
  const dsn = sentryDsn()
  if (!dsn) return
  if (
    process.env.NEXT_RUNTIME !== 'nodejs' &&
    process.env.NEXT_RUNTIME !== 'edge'
  ) {
    return
  }
  Sentry.init({
    dsn,
    environment: process.env['VERCEL_ENV'] ?? process.env['NODE_ENV'],
    tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 0,
    sendDefaultPii: false,
    // Las rutas de auth reciben ?token_hash= y ?code=: que no lleguen a Sentry.
    beforeSend: (evento) => sanearUrls(evento),
    beforeSendTransaction: (evento) => sanearUrls(evento),
    beforeBreadcrumb: (miga) => sanearUrls(miga),
  })
}

/** Errores de Server Components, Route Handlers, Server Actions y Proxy. */
export const onRequestError = Sentry.captureRequestError
