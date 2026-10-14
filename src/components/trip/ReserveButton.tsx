'use client'

import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { ButtonSize, ButtonVariant } from '@/components/ui/Button'
import { track } from '@/lib/analytics/events'
import { cn } from '@/lib/utils/cn'

/** Las reservas con depósito solo se muestran con este flag activo. */
export function reservasHabilitadas(): boolean {
  return process.env.NEXT_PUBLIC_RESERVAS_ENABLED === 'true'
}

interface ReserveButtonProps {
  /** Id de la fila guardada (trips.id), nunca el id del itinerario. */
  tripId: string
  /** @deprecated El servidor calcula el depósito: ya no se envía. */
  destino?: string
  /** @deprecated El servidor calcula el depósito: ya no se envía. */
  presupuestoTotal?: number
  /** Moneda del viaje (analítica). */
  moneda?: string
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  label?: string
  className?: string
}

interface CheckoutRespuesta {
  url?: string
  deposito?: { importe: number; moneda: string }
  error?: string
  code?: string
  mensaje?: string
  configured?: boolean
}

/**
 * «Reservar con depósito (15 %)». Envía SOLO { mode: 'reservation', tripId }:
 * el importe y la moneda los decide el servidor. Sin el flag
 * NEXT_PUBLIC_RESERVAS_ENABLED no se pinta nada.
 */
export function ReserveButton({
  tripId,
  moneda,
  variant = 'tinta',
  size = 'lg',
  fullWidth = false,
  label = 'Reservar con depósito (15 %)',
  className,
}: ReserveButtonProps) {
  const [loading, setLoading] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [noDisponible, setNoDisponible] = useState(false)

  if (!reservasHabilitadas()) return null

  if (noDisponible) {
    return (
      <p className={cn('text-caption text-fg-muted', className)}>
        Las reservas con depósito aún no están disponibles para este viaje.
      </p>
    )
  }

  async function reservar() {
    setLoading(true)
    setAviso(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'reservation', tripId }),
      })
      const data = (await res.json().catch(() => ({}))) as CheckoutRespuesta
      if (res.ok && data.url) {
        track('checkout_iniciado', {
          tipo: 'reserva',
          moneda: data.deposito?.moneda ?? moneda,
          tripId,
        })
        window.location.assign(data.url)
        return
      }
      if (res.status === 401) {
        window.location.assign(
          `/login?redirect=${encodeURIComponent(`/trip/${tripId}`)}`
        )
        return
      }
      if (res.status === 403 && data.code === 'reservations_disabled') {
        setNoDisponible(true)
        return
      }
      // Un solo aviso, junto al botón. En el 503 `checkout_unavailable` el
      // texto para el usuario viene en `mensaje` (`error` es solo el código).
      setAviso(
        data.mensaje ??
          (data.error && data.error !== 'checkout_unavailable'
            ? data.error
            : 'Los pagos no están disponibles en este momento. Inténtalo más tarde.')
      )
    } catch {
      setAviso(
        'No pudimos abrir el pago. Revisa tu conexión e inténtalo de nuevo.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={cn('flex flex-col gap-2', fullWidth && 'w-full', className)}
    >
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        icon={<CreditCard />}
        loading={loading}
        loadingText="Abriendo el pago…"
        onClick={() => void reservar()}
      >
        {label}
      </Button>
      {aviso ? (
        <p role="status" className="text-caption text-danger">
          {aviso}
        </p>
      ) : null}
    </div>
  )
}
