import {
  NO_STORE,
  autenticar,
  errorJson,
  okJson,
  registrarError,
} from '@/app/api/trips/_lib/http'
import { getStripe, isStripeConfigured } from '@/lib/stripe/server'
import { leerSuscripcion } from '@/lib/stripe/suscripcion'
import { getBaseUrl } from '@/lib/utils/baseUrl'

/**
 * POST /api/stripe/portal — abre el portal de pagos de Stripe (cambiar plan,
 * método de pago, facturas, cancelar). Acepta cookies o Bearer (mobile).
 * Respuesta 200: { url }  ·  404 { code: 'no_customer' } si nunca pagó
 * 503 { error: 'checkout_unavailable', mensaje } si Stripe no está listo.
 */
function noDisponible(configurado = true): Response {
  return Response.json(
    {
      error: 'checkout_unavailable',
      mensaje:
        'El portal de pagos no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
      ...(configurado ? {} : { configured: false }),
    },
    { status: 503, headers: NO_STORE }
  )
}

export async function POST(request: Request): Promise<Response> {
  if (!isStripeConfigured()) return noDisponible(false)

  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const sub = await leerSuscripcion(supabase, user.id)
  const customerId = sub?.stripe_customer_id ?? null
  if (!customerId) {
    return errorJson(
      404,
      'Todavía no tienes pagos que gestionar.',
      'no_customer'
    )
  }

  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getBaseUrl()}/cuenta`,
    })
    return okJson({ url: portal.url })
  } catch (err) {
    registrarError('stripe.portal', err)
    return noDisponible()
  }
}
