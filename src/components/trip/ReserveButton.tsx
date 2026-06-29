'use client'

import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ReserveButtonProps {
  tripId: string
  destino: string
  presupuestoTotal: number
  moneda?: string
}

interface CheckoutResponse {
  url?: string
  error?: string
  configured?: boolean
}

export function ReserveButton({
  tripId,
  destino,
  presupuestoTotal,
  moneda = 'USD',
}: ReserveButtonProps) {
  const [loading, setLoading] = useState(false)
  const [notConfigured, setNotConfigured] = useState(false)

  async function handleReserve() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'reservation',
          tripId,
          destino,
          presupuestoTotal,
          moneda,
        }),
      })
      const data = (await res.json()) as CheckoutResponse

      if (data.configured === false) {
        setNotConfigured(true)
        setLoading(false)
        return
      }
      if (!data.url) {
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setLoading(false)
    }
  }

  if (notConfigured) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        title="Configura STRIPE_SECRET_KEY para habilitar los pagos"
      >
        <CreditCard className="h-4 w-4" /> Pagos no configurados — agrega
        STRIPE_SECRET_KEY
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="primary"
      size="sm"
      loading={loading}
      onClick={handleReserve}
    >
      <CreditCard className="h-4 w-4" /> Reservar ahora
    </Button>
  )
}
