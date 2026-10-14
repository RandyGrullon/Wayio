'use client'

import { useEffect } from 'react'
import { RotateCcw } from 'lucide-react'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { IlustracionRuta } from '@/components/brand/IlustracionRuta'

/**
 * Error de segmento (docs/DISENO.md §6.13): «Algo se torció en el camino»,
 * Reintentar (vuelve a pedir y pintar el segmento), Volver al inicio y el
 * código del error en mono para soporte. Nunca muestra el mensaje técnico.
 */
export default function ErrorDeRuta({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string }
  unstable_retry?: () => void
  reset?: () => void
}) {
  useEffect(() => {
    // Sentry captura los errores del servidor; aquí dejamos rastro del cliente.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(error)
    }
  }, [error])

  const reintentar = () => (unstable_retry ?? reset)?.()

  return (
    <>
      <SiteHeader cta={false} />
      <main id="contenido" className="reticula flex-1">
        <div className="mx-auto max-w-[560px] px-4 pt-24 pb-24 md:px-6">
          <IlustracionRuta variante="pregunta" className="size-28" />
          <h1 className="mt-8 font-display text-display-l text-fg">
            Algo se torció en el camino
          </h1>
          <p className="mt-4 max-w-[46ch] text-lead text-fg-muted">
            No pudimos cargar esta parte de Wayio. Inténtalo de nuevo; si sigue
            pasando, vuelve al inicio.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              variant="primary"
              size="lg"
              icon={<RotateCcw />}
              onClick={reintentar}
            >
              Reintentar
            </Button>
            <ButtonLink href="/" variant="outline" size="lg">
              Volver al inicio
            </ButtonLink>
          </div>
          {error.digest ? (
            <p className="mt-8 font-mono text-[12px] text-fg-subtle">
              Código: {error.digest}
            </p>
          ) : null}
        </div>
      </main>
    </>
  )
}
