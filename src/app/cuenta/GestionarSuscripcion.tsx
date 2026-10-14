'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import type { ButtonVariant } from '@/components/ui/Button'

/**
 * «Gestionar suscripción» → POST /api/stripe/portal → { url } (portal de
 * Stripe: cambiar plan, tarjeta, facturas, cancelar). 404 no_customer y 503
 * checkout_unavailable traen un mensaje listo para mostrar.
 */
export function GestionarSuscripcion({
  variant = 'tinta',
  label = 'Gestionar suscripción',
}: {
  variant?: ButtonVariant
  label?: string
}) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function abrirPortal() {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      let body: Record<string, unknown> = {}
      try {
        body = (await res.json()) as Record<string, unknown>
      } catch {
        // Respuesta sin JSON: se trata como fallo genérico.
      }
      const url = typeof body['url'] === 'string' ? body['url'] : null
      if (res.ok && url) {
        window.location.href = url
        return
      }
      const mensaje =
        (typeof body['mensaje'] === 'string' && body['mensaje']) ||
        (res.status !== 503 && typeof body['error'] === 'string'
          ? body['error']
          : null) ||
        'El portal de pagos no está disponible en este momento. Inténtalo de nuevo en unos minutos.'
      setError(mensaje)
    } catch {
      setError('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.')
    }
    setCargando(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant={variant}
        size="lg"
        iconEnd={<ExternalLink />}
        onClick={() => void abrirPortal()}
        loading={cargando}
        loadingText="Abriendo el portal…"
        className="self-start"
      >
        {label}
      </Button>
      {error ? <Callout tone="danger">{error}</Callout> : null}
    </div>
  )
}
