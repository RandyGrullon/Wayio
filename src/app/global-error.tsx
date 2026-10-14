'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import './globals.css'

/**
 * Pantalla de último recurso cuando falla el layout raíz. Sustituye al layout,
 * por eso define su propio <html> y <body>. Reporta el error a Sentry (si está
 * configurado) y ofrece reintentar. Diseño mínimo: se rediseñará con la UI.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    try {
      Sentry.captureException(error)
    } catch {
      /* sin monitorización disponible */
    }
  }, [error])

  return (
    <html lang="es">
      <body className="flex min-h-screen items-center justify-center bg-bg px-4 text-fg">
        <title>Algo salió mal · Wayio</title>
        <main className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-lg">
          <h1 className="text-lg font-semibold">Algo salió mal</h1>
          <p className="mt-2 text-sm text-fg-muted">
            Tuvimos un problema al cargar Wayio. Ya estamos al tanto. Puedes
            intentarlo de nuevo o volver al inicio.
          </p>
          {error.digest ? (
            <p className="mt-3 text-xs text-fg-subtle">
              Código de referencia: {error.digest}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="rounded-xl bg-fg px-4 py-2 text-sm font-semibold text-bg"
            >
              Reintentar
            </button>
            {/* Recarga completa: el router puede estar roto en este punto. */}
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-fg"
            >
              Ir al inicio
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
