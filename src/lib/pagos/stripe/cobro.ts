import 'server-only'
import type Stripe from 'stripe'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  UUID_RE,
  errorDb,
  errorJson,
  okJson,
  registrarError,
} from '@/app/api/trips/_lib/http'
import { limpiarTexto } from '@/app/api/trips/_lib/texto'
import type { PlanKey } from '@/constants/pricing'
import { esPagoUnico, precioDePlan } from '@/lib/stripe/plans'
import { getStripe } from '@/lib/stripe/server'
import { createAdminClientSafe } from '@/lib/supabase/admin'
import type { SubscriptionRow } from '@/types/database'
import type { Trip } from '@/types/trip'

/**
 * Cobro con Stripe (PAYMENTS_PROVIDER=stripe). Es el código del checkout de
 * Stripe de siempre, movido aquí para que las rutas genéricas de /api/pagos
 * elijan proveedor. Las validaciones comunes (plan a la venta, ya suscrito,
 * plan concedido, viaje del pase) las hace src/lib/pagos/rutas.ts.
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

export const ReservaSchema = z.object({
  mode: z.literal('reservation'),
  tripId: z.string().regex(UUID_RE),
})

function esMonedaReserva(m: string): m is MonedaReserva {
  return Object.prototype.hasOwnProperty.call(MONEDAS_RESERVA, m)
}

export interface CtxStripe {
  stripe: Stripe
  supabase: SupabaseClient
  user: User
  baseUrl: string
}

export function ctxStripe(
  supabase: SupabaseClient,
  user: User,
  baseUrl: string
): CtxStripe {
  return { stripe: getStripe(), supabase, user, baseUrl }
}

/**
 * Customer de Stripe del usuario: reutiliza el guardado (si sigue vivo) o
 * crea uno nuevo y lo guarda, para no duplicar clientes (MON-09).
 */
async function obtenerCustomer(
  ctx: CtxStripe,
  sub: SubscriptionRow | null
): Promise<string> {
  // Un cliente de Creem (cust_…) no sirve en Stripe.
  const guardado = sub?.stripe_customer_id ?? null
  const existente = guardado?.startsWith('cus_') ? guardado : null
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

/** URL del portal de pagos de Stripe para un customer. */
export async function portalStripe(
  stripe: Stripe,
  customerId: string,
  baseUrl: string
): Promise<string> {
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/cuenta`,
  })
  return portal.url
}

/**
 * Checkout de un plan. Devuelve la URL o null si Stripe no la dio (o falta
 * el precio del plan).
 */
export async function checkoutPlanStripe(
  ctx: CtxStripe,
  datos: { planId: PlanKey; tripId: string | null; sub: SubscriptionRow | null }
): Promise<string | null> {
  const priceId = precioDePlan(datos.planId)
  if (!priceId) {
    registrarError(
      'stripe.checkout',
      `falta el precio del plan ${datos.planId}`
    )
    return null
  }

  const customer = await obtenerCustomer(ctx, datos.sub)
  const metadata: Record<string, string> = {
    userId: ctx.user.id,
    planId: datos.planId,
    ...(datos.tripId ? { tripId: datos.tripId } : {}),
  }
  const unico = esPagoUnico(datos.planId)

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: unico ? 'payment' : 'subscription',
    customer,
    client_reference_id: ctx.user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${ctx.baseUrl}/cuenta?pago=ok`,
    cancel_url: `${ctx.baseUrl}/precios?cancelado=1`,
    metadata,
    ...(unico
      ? { payment_intent_data: { metadata } }
      : { subscription_data: { metadata } }),
  }

  const session = await ctx.stripe.checkout.sessions.create(params)
  return session.url ?? null
}

/**
 * Depósito de reserva (solo Stripe y solo con NEXT_PUBLIC_RESERVAS_ENABLED;
 * el importe y la moneda se calculan aquí con el viaje guardado).
 */
export async function checkoutReservaStripe(
  ctx: CtxStripe,
  body: unknown,
  sub: SubscriptionRow | null,
  noDisponible: () => Response
): Promise<Response> {
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

/** Programa (o deshace) la baja al final del periodo en Stripe. */
export async function bajaAlFinalStripe(
  subscriptionId: string,
  cancelar: boolean
): Promise<{ cancelAtPeriodEnd: boolean }> {
  const sub = await getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: cancelar,
  })
  return { cancelAtPeriodEnd: sub.cancel_at_period_end }
}
