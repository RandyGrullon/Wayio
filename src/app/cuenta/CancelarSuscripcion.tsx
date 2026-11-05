'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'

/**
 * Baja de la suscripción al FINAL del periodo pagado (y deshacerla), sin
 * salir de Wayio: POST /api/pagos/suscripcion { accion: 'cancelar' |
 * 'reanudar' }. Funciona igual con cualquier proveedor de cobro y así se
 * cumple lo que promete la página de planes: si cancelas, sigues con tu
 * plan hasta el final de lo que ya pagaste. Tras el cambio se recarga la página
 * (la frase de vigencia pasa a «Cancelado: tienes acceso hasta…»).
 */
export function CancelarSuscripcion({
  cancelada,
  hasta,
}: {
  /** Ya tiene la baja programada (cancel_at_period_end). */
  cancelada: boolean
  /** Fecha legible del fin del periodo pagado, si se conoce. */
  hasta: string | null
}) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(accion: 'cancelar' | 'reanudar') {
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch('/api/pagos/suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      })
      let body: Record<string, unknown> = {}
      try {
        body = (await res.json()) as Record<string, unknown>
      } catch {
        // Respuesta sin JSON: se trata como fallo genérico.
      }
      if (res.ok) {
        setConfirmando(false)
        router.refresh()
      } else {
        setError(
          (typeof body['mensaje'] === 'string' && body['mensaje']) ||
            (typeof body['error'] === 'string' && res.status !== 503
              ? body['error']
              : null) ||
            'No pudimos cambiar tu suscripción ahora mismo. Inténtalo de nuevo en unos minutos.'
        )
      }
    } catch {
      setError('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.')
    }
    setEnviando(false)
  }

  if (cancelada) {
    return (
      <div className="flex flex-col gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={() => void enviar('reanudar')}
          loading={enviando}
          loadingText="Reanudando…"
          className="self-start"
        >
          Mantener mi suscripción
        </Button>
        {error ? <Callout tone="danger">{error}</Callout> : null}
      </div>
    )
  }

  if (!confirmando) {
    return (
      <Button
        variant="ghost"
        size="lg"
        onClick={() => setConfirmando(true)}
        className="self-start"
      >
        Cancelar suscripción
      </Button>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <Callout tone="warning" title="¿Cancelar tu suscripción?">
        {hasta
          ? `Seguirás con tu plan hasta el ${hasta} y no se te volverá a cobrar. Después pasarás al plan Gratis.`
          : 'Seguirás con tu plan hasta el final del periodo que ya pagaste y no se te volverá a cobrar. Después pasarás al plan Gratis.'}
      </Callout>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="danger-outline"
          size="lg"
          onClick={() => void enviar('cancelar')}
          loading={enviando}
          loadingText="Cancelando…"
        >
          Sí, cancelar
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={() => setConfirmando(false)}
          disabled={enviando}
        >
          No, mantenerla
        </Button>
      </div>
      {error ? <Callout tone="danger">{error}</Callout> : null}
    </div>
  )
}
