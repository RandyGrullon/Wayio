import type Stripe from 'stripe'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  NO_STORE,
  UUID_RE,
  autenticar,
  campo,
  errorDb,
  errorJson,
  leerJson,
  okJson,
  registrarError,
} from '@/app/api/trips/_lib/http'
import { limpiarTexto } from '@/app/api/trips/_lib/texto'
import {
  getStripe,
  isStripeConfigured,
  reservasHabilitadas,
} from '@/lib/stripe/server'
import { esPagoUnico, esPlanKey, precioDePlan } from '@/lib/stripe/plans'
import { tierEfectivo } from '@/lib/stripe/entitlements'
import {
  leerSuscripcion,
  tieneRecurrenteActiva,
} from '@/lib/stripe/suscripcion'
import { createAdminClientSafe } from '@/lib/supabase/admin'
import { getBaseUrl } from '@/lib/utils/baseUrl'
import { rateLimit, tooManyRequests } from '@/lib/security/rateLimit'
import type { SubscriptionRow } from '@/types/database'
import type { Trip } from '@/types/trip'

/**
 * POST /api/stripe/checkout — abre un Stripe Checkout.
 * Acepta sesión por cookies (web) o `Authorization: Bearer` (mobile).
 *
 * Planes: { planId: 'pro_mensual'|'pro_anual'|'pro_por_viaje'|'pro_grupo',
 *           tripId?: uuid (solo pro_por_viaje: liga el pase a ese viaje) }
 *   → 200 { url }                       Checkout (success /cuenta?pago=ok,
 *                                       cancel /precios?cancelado=1)
 *   → 200 { url, portal: true, mensaje } ya tiene suscripción: portal
 *   → 409 { error, code: 'already_pro' } plan concedido vigente
 *
 * Reserva: { mode: 'reservation', tripId: uuid } (se ignora cualquier importe
 *   o moneda del cliente: se calculan en el servidor con el viaje guardado)
 *   → 200 { url, deposito: { importe, moneda } } (success
 *     /trip/<id>?reserva=ok, cancel /trip/<id>?reserva=cancelada)
 *   → 403 { code: 'reservations_disabled' } si NEXT_PUBLIC_RESERVAS_ENABLED
 *     no es 'true' (por defecto: desactivado)
 *
 * Sin Stripe configurado o si Stripe falla:
 *   → 503 { error: 'checkout_unavailable', mensaje, configured? }
 */

const RESERVATION_DEPOSIT_RATE = 0.15
/** Mínimo por moneda para que tenga sentido cobrar (y supere el de Stripe). */
const MONEDAS_RESERVA = {
  usd: { minimo: 5 },
  eur: { minimo: 5 },
  dop: { minimo: 300 },
} as const
type MonedaReserva = keyof typeof MONEDAS_RESERVA
/** Tope de Stripe por línea en monedas de 2 decimales (999.999,99). */
const MAX_UNIT_AMOUNT = 99_999_999

const ReservaSchema = z.object({
  mode: z.literal('reservation'),
  tripId: z.string().regex(UUID_RE),
})

const PlanSchema = z.object({
  planId: z.string().max(40),
  tripId: z.string().regex(UUID_RE).optional(),
})

function noDisponible(configurado = true): Response {
  return Response.json(
    {
      error: 'checkout_unavailable',
      mensaje: configurado
        ? 'Los pagos no están disponibles en este momento. Inténtalo de nuevo en unos minutos.'
        : 'Los pagos en línea todavía no están disponibles. Muy pronto podrás mejorar tu plan.',
      ...(configurado ? {} : { configured: false }),
    },
    { status: 503, headers: NO_STORE }
  )
}

function esMonedaReserva(m: string): m is MonedaReserva {
  return Object.prototype.hasOwnProperty.call(MONEDAS_RESERVA, m)
}

interface Ctx {
  stripe: Stripe
  supabase: SupabaseClient
  user: User
  baseUrl: string
}

/**
 * Customer de Stripe del usuario: reutiliza el guardado (si sigue vivo) o
 * crea uno nuevo y lo guarda, para no duplicar clientes (MON-09).
 */
async function obtenerCustomer(
  ctx: Ctx,
  sub: SubscriptionRow | null
): Promise<string> {
  const existente = sub?.stripe_customer_id ?? null
  if (existente) {
    try {
      const c = await ctx.stripe.customers.retrieve(existente)
      if (!('deleted' in c && c.deleted)) return existente
    } catch {
      // No existe en esta cuenta/modo de Stripe: se crea otro abajo.
    }
  }

  const nuevo = await ctx.stripe.customers.create(
    {
      ...(ctx.user.email ? { email: ctx.user.email } : {}),
      metadata: { userId: ctx.user.id },
    },
    {
      idempotencyKey:
        `wayio-customer-${ctx.user.id}-${existente ?? 'nuevo'}-${ctx.user.email ?? ''}`.slice(
          0,
          255
        ),
    }
  )

  const admin = createAdminClientSafe()
  if (admin) {
    const { error } = await admin
      .from('subscriptions')
      .upsert(
        { user_id: ctx.user.id, stripe_customer_id: nuevo.id },
        { onConflict: 'user_id' }
      )
    if (error) registrarError('stripe.checkout.customer', error)
  }
  return nuevo.id
}

async function checkoutPlan(ctx: Ctx, body: unknown): Promise<Response> {
  const parsed = PlanSchema.safeParse(body)
  const planId = parsed.success ? parsed.data.planId : null
  if (!parsed.success || !esPlanKey(planId)) {
    return errorJson(400, 'Elige un plan válido.', 'invalid_plan')
  }

  const priceId = precioDePlan(planId)
  if (!priceId) {
    registrarError('stripe.checkout', `falta el precio del plan ${planId}`)
    return noDisponible()
  }

  const sub = await leerSuscripcion(ctx.supabase, ctx.user.id)

  // Ya paga una suscripción: no se abre otra, se le manda al portal.
  if (tieneRecurrenteActiva(sub) && sub?.stripe_customer_id) {
    const portal = await ctx.stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${ctx.baseUrl}/cuenta`,
    })
    return okJson({
      url: portal.url,
      portal: true,
      mensaje:
        'Ya tienes una suscripción activa. Puedes cambiarla o cancelarla desde el portal de pagos.',
    })
  }

  // Plan concedido a mano y vigente: no tiene sentido cobrarle.
  if (sub?.source === 'admin' && tierEfectivo(sub) !== 'free') {
    return errorJson(
      409,
      'Ya tienes Wayio Pro activo en tu cuenta.',
      'already_pro'
    )
  }

  // Pro por viaje: si llega un tripId que es del usuario, el pase se ajusta a
  // las fechas de ese viaje (ver el webhook).
  let tripId: string | null = null
  if (esPagoUnico(planId) && parsed.data.tripId) {
    const { data } = await ctx.supabase
      .from('trips')
      .select('id')
      .eq('id', parsed.data.tripId)
      .eq('user_id', ctx.user.id)
      .maybeSingle()
    tripId = data ? parsed.data.tripId : null
  }

  const customer = await obtenerCustomer(ctx, sub)
  const metadata: Record<string, string> = {
    userId: ctx.user.id,
    planId,
    ...(tripId ? { tripId } : {}),
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: esPagoUnico(planId) ? 'payment' : 'subscription',
    customer,
    client_reference_id: ctx.user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${ctx.baseUrl}/cuenta?pago=ok`,
    cancel_url: `${ctx.baseUrl}/precios?cancelado=1`,
    metadata,
    ...(esPagoUnico(planId)
      ? { payment_intent_data: { metadata } }
      : { subscription_data: { metadata } }),
  }

  const session = await ctx.stripe.checkout.sessions.create(params)
  if (!session.url) return noDisponible()
  return okJson({ url: session.url })
}

async function checkoutReserva(ctx: Ctx, body: unknown): Promise<Response> {
  if (!reservasHabilitadas()) {
    return errorJson(
      403,
      'Las reservas en línea todavía no están disponibles. Te avisaremos en cuanto lo estén.',
      'reservations_disabled'
    )
  }

  const parsed = ReservaSchema.safeParse(body)
  if (!parsed.success) {
    return errorJson(
      400,
      'Guarda primero el viaje para poder reservarlo.',
      'invalid_trip'
    )
  }
  const { tripId } = parsed.data

  const { data, error } = await ctx.supabase
    .from('trips')
    .select('id, data')
    .eq('id', tripId)
    .eq('user_id', ctx.user.id)
    .maybeSingle()
  if (error) return errorDb(error, 'stripe.checkout.trip')
  if (!data) {
    return errorJson(
      404,
      'No encontramos este viaje entre los tuyos. Guárdalo antes de reservar.',
      'trip_not_found'
    )
  }

  const trip = (data as { data: Partial<Trip> | null }).data ?? {}
  const total = Number(trip.presupuestoTotal)
  const moneda = String(trip.moneda ?? 'USD').toLowerCase()
  if (!esMonedaReserva(moneda)) {
    return errorJson(
      400,
      'Este viaje está en una moneda que todavía no admite reservas en línea.',
      'invalid_currency'
    )
  }
  if (!Number.isFinite(total) || total <= 0) {
    return errorJson(
      400,
      'Este viaje no tiene un presupuesto válido para calcular el depósito.',
      'invalid_budget'
    )
  }

  const deposito = Math.max(
    MONEDAS_RESERVA[moneda].minimo,
    Math.round(total * RESERVATION_DEPOSIT_RATE * 100) / 100
  )
  const unitAmount = Math.round(deposito * 100)
  if (unitAmount > MAX_UNIT_AMOUNT) {
    return errorJson(
      400,
      'El depósito de este viaje supera lo que podemos cobrar en línea. Escríbenos y lo gestionamos contigo.',
      'amount_too_high'
    )
  }

  const destino =
    limpiarTexto(String(trip.destino ?? ''))
      .trim()
      .slice(0, 80) || 'tu viaje'
  const sub = await leerSuscripcion(ctx.supabase, ctx.user.id)
  const customer = await obtenerCustomer(ctx, sub)
  const metadata: Record<string, string> = {
    userId: ctx.user.id,
    type: 'reservation',
    tripId,
  }

  const session = await ctx.stripe.checkout.sessions.create({
    mode: 'payment',
    customer,
    client_reference_id: ctx.user.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: moneda,
          unit_amount: unitAmount,
          product_data: {
            name: `Depósito de reserva: ${destino}`,
            description: `Depósito del ${Math.round(
              RESERVATION_DEPOSIT_RATE * 100
            )}% del presupuesto estimado del viaje.`,
          },
        },
      },
    ],
    success_url: `${ctx.baseUrl}/trip/${tripId}?reserva=ok`,
    cancel_url: `${ctx.baseUrl}/trip/${tripId}?reserva=cancelada`,
    metadata,
    payment_intent_data: { metadata },
  })

  if (!session.url) return noDisponible()
  return okJson({
    url: session.url,
    deposito: { importe: deposito, moneda: moneda.toUpperCase() },
  })
}

export async function POST(request: Request): Promise<Response> {
  if (!isStripeConfigured()) return noDisponible(false)

  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const limite = await rateLimit({
    bucket: 'stripe-checkout',
    id: user.id,
    limit: 10,
    windowSec: 600,
  })
  if (!limite.ok) return tooManyRequests(limite)

  const leido = await leerJson(request, 4_000)
  if (!leido.ok) return leido.response

  const ctx: Ctx = {
    stripe: getStripe(),
    supabase,
    user,
    baseUrl: getBaseUrl(),
  }

  try {
    return campo(leido.body, 'mode') === 'reservation'
      ? await checkoutReserva(ctx, leido.body)
      : await checkoutPlan(ctx, leido.body)
  } catch (err) {
    registrarError('stripe.checkout', err)
    return noDisponible()
  }
}
