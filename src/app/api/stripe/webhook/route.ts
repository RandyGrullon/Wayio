import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  esFaltaDeEsquema,
  esUuid,
  registrarError,
} from '@/app/api/trips/_lib/http'
import { trackServerEvent } from '@/lib/analytics/posthog'
import { tierEfectivo } from '@/lib/stripe/entitlements'
import {
  epochAIso,
  esPlanKey,
  estadoConAcceso,
  mapearEstado,
  planDesdePrecio,
  precioDePlan,
  tierDePlan,
} from '@/lib/stripe/plans'
import { getStripe, idDe, isStripeWebhookConfigured } from '@/lib/stripe/server'
import { createAdminClientSafe } from '@/lib/supabase/admin'
import type { PlanKey } from '@/constants/pricing'
import type { SubscriptionRow } from '@/types/database'
import type { PlanId } from '@/types/subscription'

/**
 * POST /api/stripe/webhook — eventos de Stripe (firma verificada).
 *
 * Escribe con la SERVICE ROLE (la petición de Stripe no trae sesión y RLS
 * bloquearía cualquier escritura con la anon key). Si algo falla responde
 * 500 para que Stripe REINTENTE; los eventos que no interesan reciben 200.
 * Cada event.id se procesa una sola vez (tabla stripe_events).
 *
 * Eventos: checkout.session.completed, checkout.session.async_payment_succeeded,
 * checkout.session.async_payment_failed, customer.subscription.created,
 * customer.subscription.updated, customer.subscription.deleted, invoice.paid,
 * invoice.payment_failed.
 *
 * DECISIÓN «Pro por viaje» (pago único, MON-04): NO concede Pro permanente.
 * Activa tier 'pro' con current_period_end = fin del viaje + 7 días si el
 * checkout trae el tripId de un viaje del usuario; si no, 30 días desde el
 * pago. Siempre entre 7 y 365 días. Comprar otro pase extiende la fecha (no la
 * acorta). No pisa una suscripción recurrente activa.
 */

interface Ctx {
  stripe: Stripe
  admin: SupabaseClient
}

const DIA_MS = 86_400_000

type FilaSuscripcion = Partial<SubscriptionRow> & { user_id: string }

function trackSeguro(
  userId: string,
  event: string,
  properties: Record<string, unknown>
): void {
  if (!process.env['NEXT_PUBLIC_POSTHOG_KEY']) return
  try {
    trackServerEvent(userId, event, properties)
  } catch {
    // la analítica nunca debe tumbar el webhook
  }
}

function fallo(
  contexto: string,
  error: { code?: string; message?: string }
): Error {
  return new Error(
    `${contexto}: ${error.code ?? ''} ${error.message ?? ''}`.trim()
  )
}

async function leerFilaUsuario(
  ctx: Ctx,
  userId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await ctx.admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw fallo('leer suscripción', error)
  return (data as SubscriptionRow | null) ?? null
}

/** Upsert por user_id. Si falta la columna source (sin migración), reintenta sin ella. */
async function guardarFila(ctx: Ctx, fila: FilaSuscripcion): Promise<void> {
  const { error } = await ctx.admin
    .from('subscriptions')
    .upsert(fila, { onConflict: 'user_id' })
  if (!error) return
  if (esFaltaDeEsquema(error) && 'source' in fila) {
    const sinSource: FilaSuscripcion = { ...fila }
    delete sinSource.source
    const { error: error2 } = await ctx.admin
      .from('subscriptions')
      .upsert(sinSource, { onConflict: 'user_id' })
    if (!error2) return
    throw fallo('guardar suscripción', error2)
  }
  throw fallo('guardar suscripción', error)
}

// ---------------------------------------------------------------------------
// Suscripciones recurrentes
// ---------------------------------------------------------------------------

/** Lleva el estado de una suscripción de Stripe a la fila del usuario. */
async function sincronizarSuscripcion(
  ctx: Ctx,
  sub: Stripe.Subscription,
  userIdSugerido: string | null
): Promise<void> {
  const item = sub.items.data[0]
  const priceId = item?.price.id ?? null
  const customerId = idDe(sub.customer)
  const acceso = estadoConAcceso(sub.status)

  // 1. ¿De qué usuario es? Por la propia suscripción, el userId del checkout,
  //    la metadata de la suscripción o el customer.
  const porSub = await ctx.admin
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle()
  if (porSub.error) throw fallo('buscar por suscripción', porSub.error)

  let actual = (porSub.data as SubscriptionRow | null) ?? null
  let userId = actual?.user_id ?? null
  if (!userId) {
    const meta = sub.metadata?.['userId']
    userId = esUuid(userIdSugerido)
      ? userIdSugerido
      : esUuid(meta)
        ? meta
        : null
  }
  if (!userId && customerId) {
    const porCustomer = await ctx.admin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    if (porCustomer.error) throw fallo('buscar por customer', porCustomer.error)
    userId = (porCustomer.data as { user_id: string } | null)?.user_id ?? null
  }
  if (!userId) {
    // No se puede asociar: reintentar no lo arreglará.
    registrarError(
      'stripe.webhook',
      `suscripción ${sub.id} sin usuario asociado`
    )
    return
  }
  if (!actual) actual = await leerFilaUsuario(ctx, userId)

  // 2. Un evento sin acceso de una suscripción que NO es la vigente del
  //    usuario (vieja, o un intento fallido) no le quita el plan actual.
  if (!acceso && actual) {
    const otraSuscripcion =
      actual.stripe_subscription_id !== null &&
      actual.stripe_subscription_id !== sub.id
    const planVigenteSinStripe =
      actual.stripe_subscription_id === null && tierEfectivo(actual) !== 'free'
    if (otraSuscripcion || planVigenteSinStripe) return
  }

  // 3. Plan: por el precio de Stripe; si no se reconoce, la metadata o el
  //    plan que ya tenía.
  const metaPlan = sub.metadata?.['planId']
  let plan: PlanId | null =
    planDesdePrecio(priceId) ?? (esPlanKey(metaPlan) ? metaPlan : null)
  if (!plan && actual && actual.plan_id !== 'free') plan = actual.plan_id
  if (!plan && acceso) {
    registrarError(
      'stripe.webhook',
      `precio ${priceId ?? '-'} sin plan conocido`
    )
    plan = 'pro_mensual'
  }

  const planFinal: PlanId = acceso && plan ? plan : 'free'
  await guardarFila(ctx, {
    user_id: userId,
    plan_id: planFinal,
    tier: tierDePlan(planFinal),
    status: mapearEstado(sub.status),
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    current_period_end: epochAIso(item?.current_period_end),
    cancel_at_period_end: sub.cancel_at_period_end,
    source: 'stripe',
    ...(customerId ? { stripe_customer_id: customerId } : {}),
  })
}

// ---------------------------------------------------------------------------
// Pagos únicos (Pro por viaje)
// ---------------------------------------------------------------------------

async function finPaseUnico(
  ctx: Ctx,
  userId: string,
  tripId: string | null
): Promise<number> {
  const ahora = Date.now()
  let fin = ahora + 30 * DIA_MS
  if (tripId) {
    const { data, error } = await ctx.admin
      .from('trips')
      .select('data')
      .eq('id', tripId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw fallo('leer viaje del pase', error)
    const fechaFin = (data as { data?: { fechaFin?: unknown } } | null)?.data
      ?.fechaFin
    const t =
      typeof fechaFin === 'string'
        ? Date.parse(`${fechaFin.slice(0, 10)}T23:59:59Z`)
        : Number.NaN
    if (Number.isFinite(t)) fin = t + 7 * DIA_MS
  }
  return Math.min(Math.max(fin, ahora + 7 * DIA_MS), ahora + 365 * DIA_MS)
}

async function activarPaseUnico(
  ctx: Ctx,
  datos: {
    userId: string
    planId: PlanKey
    customerId: string | null
    tripId: string | null
  }
): Promise<void> {
  const actual = await leerFilaUsuario(ctx, datos.userId)

  // Ya paga una suscripción recurrente con acceso: no se le cambia el plan.
  if (
    actual?.stripe_subscription_id &&
    actual.tier !== 'free' &&
    (actual.status === 'active' ||
      actual.status === 'trialing' ||
      actual.status === 'past_due')
  ) {
    registrarError(
      'stripe.webhook',
      `pase ${datos.planId} de ${datos.userId} con suscripción activa: plan sin cambios`
    )
    if (datos.customerId && !actual.stripe_customer_id) {
      await guardarFila(ctx, {
        user_id: datos.userId,
        stripe_customer_id: datos.customerId,
      })
    }
    return
  }

  const fin = await finPaseUnico(ctx, datos.userId, datos.tripId)
  const finActual =
    actual?.plan_id === datos.planId && actual.current_period_end
      ? Date.parse(actual.current_period_end)
      : 0
  const finFinal = Math.max(fin, Number.isFinite(finActual) ? finActual : 0)

  await guardarFila(ctx, {
    user_id: datos.userId,
    plan_id: datos.planId,
    tier: tierDePlan(datos.planId),
    status: 'active',
    stripe_subscription_id: null,
    stripe_price_id: precioDePlan(datos.planId),
    current_period_end: new Date(finFinal).toISOString(),
    cancel_at_period_end: false,
    source: 'stripe',
    ...(datos.customerId ? { stripe_customer_id: datos.customerId } : {}),
  })
}

// ---------------------------------------------------------------------------
// Reservas (depósito)
// ---------------------------------------------------------------------------

async function guardarReserva(
  ctx: Ctx,
  session: Stripe.Checkout.Session,
  estadoPago: string
): Promise<void> {
  const meta = session.metadata ?? {}
  const userId = meta['userId'] ?? session.client_reference_id
  if (!esUuid(userId)) {
    registrarError('stripe.webhook', `reserva ${session.id} sin usuario`)
    return
  }

  // Si el viaje ya no existe se guarda igual el pago (trip_id null).
  let tripId: string | null = null
  const tripMeta = meta['tripId']
  if (esUuid(tripMeta)) {
    const { data, error } = await ctx.admin
      .from('trips')
      .select('id')
      .eq('id', tripMeta)
      .maybeSingle()
    if (error) throw fallo('leer viaje de la reserva', error)
    tripId = data ? tripMeta : null
  }

  // Eventos fuera de orden: un 'completed' sin pagar que llega después del
  // async_payment_succeeded no puede devolver a 'unpaid' una reserva pagada.
  if (estadoPago !== 'paid') {
    const previa = await ctx.admin
      .from('reservations')
      .select('payment_status')
      .eq('stripe_session_id', session.id)
      .maybeSingle()
    if (previa.error) throw fallo('leer reserva', previa.error)
    const estadoPrevio = (previa.data as { payment_status?: string } | null)
      ?.payment_status
    if (estadoPrevio === 'paid') return
  }

  const { error } = await ctx.admin.from('reservations').upsert(
    {
      user_id: userId,
      trip_id: tripId,
      amount_total: session.amount_total ?? 0,
      currency: (session.currency ?? 'usd').toLowerCase(),
      stripe_session_id: session.id,
      stripe_payment_intent_id: idDe(session.payment_intent),
      payment_status: estadoPago,
    },
    { onConflict: 'stripe_session_id' }
  )
  if (error) throw fallo('guardar reserva', error)
  if (estadoPago === 'paid') {
    trackSeguro(userId, 'reservation_paid', {
      tripId,
      currency: session.currency,
    })
  }
}

// ---------------------------------------------------------------------------
// Despacho de eventos
// ---------------------------------------------------------------------------

async function alCompletarCheckout(
  ctx: Ctx,
  session: Stripe.Checkout.Session
): Promise<void> {
  const meta = session.metadata ?? {}
  if (meta['type'] === 'reservation') {
    await guardarReserva(ctx, session, session.payment_status)
    return
  }

  // Pago asíncrono todavía pendiente: llegará async_payment_succeeded.
  if (
    session.payment_status !== 'paid' &&
    session.payment_status !== 'no_payment_required'
  ) {
    return
  }

  const userId = meta['userId'] ?? session.client_reference_id
  const planId = meta['planId']
  if (!esUuid(userId) || !esPlanKey(planId)) {
    registrarError(
      'stripe.webhook',
      `checkout ${session.id} sin metadata válida`
    )
    return
  }

  const customerId = idDe(session.customer)
  if (session.mode === 'subscription') {
    const subId = idDe(session.subscription)
    if (!subId) throw new Error(`checkout ${session.id} sin suscripción`)
    const sub = await ctx.stripe.subscriptions.retrieve(subId)
    await sincronizarSuscripcion(ctx, sub, userId)
  } else {
    const tripMeta = meta['tripId']
    await activarPaseUnico(ctx, {
      userId,
      planId,
      customerId,
      tripId: esUuid(tripMeta) ? tripMeta : null,
    })
  }
  trackSeguro(userId, 'pro_converted', { planId })
}

async function alFallarPagoAsincrono(
  ctx: Ctx,
  session: Stripe.Checkout.Session
): Promise<void> {
  if (session.metadata?.['type'] === 'reservation') {
    await guardarReserva(ctx, session, 'failed')
  }
}

async function alCambiarFactura(
  ctx: Ctx,
  invoice: Stripe.Invoice
): Promise<void> {
  const subId = idDe(invoice.parent?.subscription_details?.subscription)
  if (!subId) return
  const sub = await ctx.stripe.subscriptions.retrieve(subId)
  await sincronizarSuscripcion(ctx, sub, null)
}

/**
 * Stripe no garantiza el orden de entrega: un customer.subscription.created
 * ('incomplete') puede llegar DESPUÉS del checkout ya activo y degradar el
 * plan. Por eso se sincroniza siempre con el estado ACTUAL de la suscripción
 * (y solo si Stripe ya no la tiene, con la copia del evento).
 */
async function alCambiarSuscripcion(
  ctx: Ctx,
  copia: Stripe.Subscription
): Promise<void> {
  let sub: Stripe.Subscription
  try {
    sub = await ctx.stripe.subscriptions.retrieve(copia.id)
  } catch (err) {
    if ((err as { code?: string } | null)?.code !== 'resource_missing') {
      throw err
    }
    sub = copia
  }
  await sincronizarSuscripcion(ctx, sub, null)
}

async function procesarEvento(ctx: Ctx, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      await alCompletarCheckout(ctx, event.data.object)
      return
    case 'checkout.session.async_payment_failed':
      await alFallarPagoAsincrono(ctx, event.data.object)
      return
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await alCambiarSuscripcion(ctx, event.data.object)
      return
    case 'invoice.paid':
    case 'invoice.payment_failed':
      await alCambiarFactura(ctx, event.data.object)
      return
    default:
      return
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isStripeWebhookConfigured()) {
    return Response.json({ error: 'webhook_unavailable' }, { status: 503 })
  }

  const firma = request.headers.get('stripe-signature')
  if (!firma) {
    return Response.json({ error: 'missing_signature' }, { status: 400 })
  }

  const body = await request.text()
  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      firma,
      process.env['STRIPE_WEBHOOK_SECRET'] as string
    )
  } catch {
    return Response.json({ error: 'invalid_signature' }, { status: 400 })
  }

  const admin = createAdminClientSafe()
  if (!admin) {
    // Sin service role no se puede escribir: 500 para que Stripe reintente
    // cuando el servidor esté bien configurado.
    registrarError('stripe.webhook', 'falta la service role de Supabase')
    return Response.json({ error: 'not_configured' }, { status: 500 })
  }

  // Idempotencia: si este evento ya se procesó, no se repite.
  const visto = await admin
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle()
  if (!visto.error && visto.data) {
    return Response.json({ received: true, duplicate: true })
  }

  const ctx: Ctx = { stripe, admin }
  try {
    await procesarEvento(ctx, event)
  } catch (err) {
    registrarError(`stripe.webhook ${event.type} ${event.id}`, err)
    return Response.json({ error: 'processing_failed' }, { status: 500 })
  }

  const marca = await admin
    .from('stripe_events')
    .insert({ id: event.id, type: event.type })
  if (
    marca.error &&
    marca.error.code !== '23505' &&
    !esFaltaDeEsquema(marca.error)
  ) {
    registrarError('stripe.webhook.idempotencia', marca.error)
  }

  return Response.json({ received: true })
}
