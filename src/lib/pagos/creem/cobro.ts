import 'server-only'
import type { User } from '@supabase/supabase-js'
import { registrarError } from '@/app/api/trips/_lib/http'
import type { PlanKey } from '@/constants/pricing'
import { crearCheckout, productoDePlan } from '@/lib/pagos/creem/server'
import { proveedorDeFila } from '@/lib/pagos/proveedor'
import type { SubscriptionRow } from '@/types/database'

/**
 * Checkout de un plan con Creem. Devuelve la URL del pago o null si falta el
 * producto del plan o Creem no la dio. Creem crea el cliente al pagar; si el
 * usuario ya pagó antes con Creem se reutiliza su cliente (mismo portal y
 * mismas facturas), si no se rellena su email.
 *
 * La metadata (userId, planId y, en el pase, tripId) se copia a la
 * suscripción: el webhook la usa para saber de quién es cada evento.
 */
export async function checkoutPlanCreem(datos: {
  user: User
  planId: PlanKey
  tripId: string | null
  sub: SubscriptionRow | null
  baseUrl: string
}): Promise<string | null> {
  const productId = productoDePlan(datos.planId)
  if (!productId) {
    registrarError(
      'creem.checkout',
      `falta el producto del plan ${datos.planId}`
    )
    return null
  }

  const clienteCreem =
    proveedorDeFila(datos.sub) === 'creem' &&
    datos.sub?.stripe_customer_id?.startsWith('cust_')
      ? datos.sub.stripe_customer_id
      : null

  const checkout = await crearCheckout({
    productId,
    successUrl: `${datos.baseUrl}/cuenta?pago=ok`,
    requestId: datos.user.id,
    metadata: {
      userId: datos.user.id,
      planId: datos.planId,
      ...(datos.tripId ? { tripId: datos.tripId } : {}),
    },
    cliente: clienteCreem
      ? { id: clienteCreem }
      : datos.user.email
        ? { email: datos.user.email }
        : null,
  })
  return checkout.checkout_url ?? null
}
