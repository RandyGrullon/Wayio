'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'

/**
 * Vuelta de Stripe con ?pago=ok. El webhook puede tardar unos segundos en
 * activar el plan: si todavía sale «gratis», se ofrece volver a comprobar.
 */
export function AvisoPago({ activo }: { activo: boolean }) {
  const router = useRouter()
  const [comprobando, startComprobar] = useTransition()

  if (activo) {
    return (
      <Callout tone="success" title="¡Gracias! Tu plan ya está activo">
        Recibimos tu pago. Ya puedes usar todas las funciones de tu plan.
      </Callout>
    )
  }

  return (
    <Callout
      tone="success"
      title="¡Gracias! Recibimos tu pago"
      action={
        <Button
          variant="link"
          icon={<RefreshCw />}
          loading={comprobando}
          loadingText="Comprobando…"
          onClick={() => startComprobar(() => router.refresh())}
        >
          Comprobar de nuevo
        </Button>
      }
    >
      Tu plan puede tardar unos segundos en activarse. Si todavía no aparece,
      vuelve a comprobarlo en un momento.
    </Callout>
  )
}
