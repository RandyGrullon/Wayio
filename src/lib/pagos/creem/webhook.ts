import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { esUuid, registrarError } from '@/app/api/trips/_lib/http'
import {
  activarPaseUnico,
  fallo,
  guardarFila,
  leerFilaUsuario,
  trackSeguro,
} from '@/lib/pagos/filaSuscripcion'
import {
  CreemError,
  idCreem,
  obtenerSuscripcion,
  planDesdeProducto,
  type CreemCheckout,
  type CreemPedido,
  type CreemSuscripcion,
} from '@/lib/pagos/creem/server'
import { tierEfectivo } from '@/lib/stripe/entitlements'
import { esPagoUnico, esPlanKey, tierDePlan } from '@/lib/stripe/plans'
import type { SubscriptionRow, SubscriptionStatus } from '@/types/database'
import type { PlanId } from '@/types/subscription'

/**
 * Webhook de Creem (docs.creem.io/code/webhooks, leída el 5-nov-2026).
 *
 * Firma: cabecera `creem-signature` = HMAC-SHA256 en hexadecimal del cuerpo
 * CRUDO con el secreto del webhook. Creem reintenta (30 s, 5 min, 30 min y
 * 6 h) mientras no reciba un 2xx y puede entregar el mismo evento dos veces:
 * el procesado es idempotente (tabla payment_events por event.id y, además,
 * cada evento lleva la fila al estado ACTUAL de la suscripción).
 *
 * Escribe en subscriptions exactamente como el webhook de Stripe (módulo
 * común src/lib/pagos/filaSuscripcion.ts), con source = 'creem'. Las columnas
 * stripe_* guardan los ids de Creem (cust_…, sub_…, prod_…): así la RPC
 * my_effective_tier, el panel admin y la app móvil funcionan sin cambios.
 */

// ---------------------------------------------------------------------------
// Firma
// ---------------------------------------------------------------------------

/** Compara en tiempo constante la firma recibida con la calculada. */
export function firmaCreemValida(
  cuerpoCrudo: string,
  firma: string | null,
  secreto: string
): boolean {
  if (!firma || !secreto) return false
  const recibida = firma.trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(recibida)) return false
  const esperada = createHmac('sha256', secreto)
    .update(cuerpoCrudo, 'utf8')
    .digest('hex')
  return timingSafeEqual(
    Buffer.from(recibida, 'hex'),
    Buffer.from(esperada, 'hex')
  )
}

/** Firma un cuerpo (lo usan las pruebas y el simulador local). */
export function firmarCreem(cuerpoCrudo: string, secreto: string): string {
  return createHmac('sha256', secreto).update(cuerpoCrudo, 'utf8').digest('hex')
}

// ---------------------------------------------------------------------------
// Evento
// ---------------------------------------------------------------------------

export const EventoCreemSchema = z.object({
  id: z.string().min(1).max(200),
  eventType: z.string().min(1).max(100),
  created_at: z.number().optional(),
  object: z.record(z.string(), z.unknown()),
})
export type EventoCreem = z.infer<typeof EventoCreemSchema>

/** Eventos de suscripción que se sincronizan con el estado actual. */
const EVENTOS_SUSCRIPCION = new Set([
  'subscription.active',
  'subscription.paid',
  'subscription.update',
  'subscription.trialing',
  'subscription.scheduled_cancel',
  'subscription.past_due',
  'subscription.unpaid',
  'subscription.paused',
  'subscription.canceled',
  'subscription.expired',
])

/** Estado que se guarda: los clásicos de la app + paused (lo admite el CHECK). */
type EstadoGuardadoCreem = Extract<
  SubscriptionStatus,
  'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'paused'
>

/**
 * Estado de Creem → fila de Wayio.
 *   scheduled_cancel → active + cancel_at_period_end (sigue con acceso hasta
 *     current_period_end_date; luego llega subscription.canceled).
 *   past_due → past_due con acceso (Creem reintenta el cobro: gracia).
 *   unpaid → canceled (sin acceso; si paga, llega subscription.active).
 *   paused → paused (sin acceso mientras no se cobra).
 */
export function mapearEstadoCreem(status: string): {
  estado: EstadoGuardadoCreem
  acceso: boolean
  cancelaAlFinal: boolean
} {
  switch (status) {
    case 'active':
      return { estado: 'active', acceso: true, cancelaAlFinal: false }
    case 'trialing':
      return { estado: 'trialing', acceso: true, cancelaAlFinal: false }
    case 'past_due':
      return { estado: 'past_due', acceso: true, cancelaAlFinal: false }
    case 'scheduled_cancel':
      return { estado: 'active', acceso: true, cancelaAlFinal: true }
    case 'paused':
      return { estado: 'paused', acceso: false, cancelaAlFinal: false }
    case 'canceled':
    case 'unpaid':
      return { estado: 'canceled', acceso: false, cancelaAlFinal: false }
    default:
      return { estado: 'incomplete', acceso: false, cancelaAlFinal: false }
  }
}

function textoMeta(
  meta: Record<string, unknown> | null | undefined,
  clave: string
): string | null {
  const v = meta?.[clave]
  return typeof v === 'string' && v ? v : null
}

function isoONull(v: string | null | undefined): string | null {
  if (!v) return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

// ---------------------------------------------------------------------------
// Suscripciones recurrentes
// ---------------------------------------------------------------------------

/** Lleva una suscripción de Creem a la fila del usuario. */
export async function sincronizarSuscripcionCreem(
  admin: SupabaseClient,
  sub: CreemSuscripcion,
  userIdSugerido: string | null
): Promise<void> {
  const productId = idCreem(sub.product)
  const customerId = idCreem(sub.customer)
  const { estado, acceso, cancelaAlFinal } = mapearEstadoCreem(
    String(sub.status)
  )

  // 1. ¿De qué usuario es? Por la propia suscripción, el userId del checkout,
  //    la metadata de la suscripción o el cliente de Creem.
  const porSub = await admin
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle()
  if (porSub.error) throw fallo('buscar por suscripción', porSub.error)

  let actual = (porSub.data as SubscriptionRow | null) ?? null
  let userId = actual?.user_id ?? null
  if (!userId) {
    const meta = textoMeta(sub.metadata, 'userId')
    userId = esUuid(userIdSugerido)
      ? userIdSugerido
      : esUuid(meta)
        ? meta
        : null
  }
  if (!userId && customerId) {
    const porCliente = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    if (porCliente.error) throw fallo('buscar por cliente', porCliente.error)
    userId = (porCliente.data as { user_id: string } | null)?.user_id ?? null
  }
  if (!userId) {
    // No se puede asociar: reintentar no lo arreglará.
    registrarError(
      'creem.webhook',
      `suscripción ${sub.id} sin usuario asociado`
    )
    return
  }
  if (!actual) actual = await leerFilaUsuario(admin, userId)

  // 2. Un evento sin acceso de una suscripción que NO es la vigente del
  //    usuario (vieja, de otro proveedor o un pase) no le quita el plan.
  if (!acceso && actual) {
    const otraSuscripcion =
      actual.stripe_subscription_id !== null &&
      actual.stripe_subscription_id !== sub.id
    const planVigenteSinSuscripcion =
      actual.stripe_subscription_id === null && tierEfectivo(actual) !== 'free'
    if (otraSuscripcion || planVigenteSinSuscripcion) return
  }

  // 3. Plan: por el producto de Creem; si no se reconoce, la metadata o el
  //    plan que ya tenía.
  const metaPlan = textoMeta(sub.metadata, 'planId')
  let plan: PlanId | null =
    planDesdeProducto(productId) ?? (esPlanKey(metaPlan) ? metaPlan : null)
  if (!plan && actual && actual.plan_id !== 'free') plan = actual.plan_id
  if (!plan && acceso) {
    registrarError(
      'creem.webhook',
      `producto ${productId ?? '-'} sin plan conocido`
    )
    plan = 'pro_mensual'
  }

  const planFinal: PlanId = acceso && plan ? plan : 'free'
  await guardarFila(admin, {
    user_id: userId,
    plan_id: planFinal,
    tier: tierDePlan(planFinal),
    status: estado,
    stripe_subscription_id: sub.id,
    stripe_price_id: productId,
    current_period_end: isoONull(sub.current_period_end_date),
    cancel_at_period_end: cancelaAlFinal,
    source: 'creem',
    ...(customerId ? { stripe_customer_id: customerId } : {}),
  })
}

/**
 * Creem no garantiza el orden de entrega: se lee el estado ACTUAL de la
 * suscripción y solo si Creem ya no la tiene (404) se usa la copia del
 * evento. Cualquier otro fallo de la API lanza → 500 → Creem reintenta.
 */
async function estadoActual(
  copia: CreemSuscripcion | null,
  id: string
): Promise<CreemSuscripcion | null> {
  try {
    return await obtenerSuscripcion(id)
  } catch (err) {
    if (err instanceof CreemError && err.status === 404) return copia
    throw err
  }
}

function suscripcionDe(v: unknown): CreemSuscripcion | null {
  return esObjeto(v) && typeof v['id'] === 'string'
    ? (v as unknown as CreemSuscripcion)
    : null
}

// ---------------------------------------------------------------------------
// Despacho
// ---------------------------------------------------------------------------

async function alCompletarCheckout(
  admin: SupabaseClient,
  checkout: CreemCheckout
): Promise<void> {
  const meta = checkout.metadata ?? null
  if (textoMeta(meta, 'type') === 'reservation') {
    // Las reservas con depósito solo existen con Stripe (ver /api/pagos).
    registrarError(
      'creem.webhook',
      `checkout ${checkout.id} de reserva ignorado`
    )
    return
  }

  const pedido: CreemPedido | null = esObjeto(checkout.order)
    ? checkout.order
    : null
  if (pedido?.status && pedido.status !== 'paid') return

  const userId = textoMeta(meta, 'userId') ?? checkout.request_id ?? null
  const productId = idCreem(checkout.product) ?? pedido?.product ?? null
  const metaPlan = textoMeta(meta, 'planId')
  const planId = esPlanKey(metaPlan) ? metaPlan : planDesdeProducto(productId)
  if (!esUuid(userId) || !planId) {
    registrarError(
      'creem.webhook',
      `checkout ${checkout.id} sin metadata válida`
    )
    return
  }

  const customerId = idCreem(checkout.customer) ?? pedido?.customer ?? null
  const subId = idCreem(checkout.subscription)
  const recurrente = pedido?.type ? pedido.type === 'recurring' : Boolean(subId)

  if (recurrente) {
    if (!subId) throw new Error(`checkout ${checkout.id} sin suscripción`)
    const sub = await estadoActual(suscripcionDe(checkout.subscription), subId)
    if (!sub) throw new Error(`suscripción ${subId} no encontrada`)
    await sincronizarSuscripcionCreem(admin, sub, userId)
  } else {
    if (!esPagoUnico(planId)) {
      registrarError(
        'creem.webhook',
        `checkout ${checkout.id}: pago único de un plan recurrente (${planId})`
      )
      return
    }
    const pagado = Date.parse(pedido?.created_at ?? '')
    const tripMeta = textoMeta(meta, 'tripId')
    await activarPaseUnico(admin, {
      userId,
      planId,
      customerId,
      tripId: esUuid(tripMeta) ? tripMeta : null,
      source: 'creem',
      precioRef: productId,
      desde:
        Number.isFinite(pagado) && pagado <= Date.now() ? pagado : Date.now(),
      contexto: 'creem.webhook',
    })
  }
  trackSeguro(userId, 'pro_converted', { planId, proveedor: 'creem' })
}

/**
 * Reembolso. Si es de una suscripción, se sincroniza (Creem decide si sigue
 * activa). Si es el pago TOTAL de un pase, el pase se retira: sin pago no hay
 * plan. Los reembolsos parciales no cambian nada.
 */
async function alReembolsar(
  admin: SupabaseClient,
  reembolso: Record<string, unknown>
): Promise<void> {
  const transaccion = esObjeto(reembolso['transaction'])
    ? reembolso['transaction']
    : {}
  const subId =
    idCreem(reembolso['subscription'] as CreemSuscripcion | string | null) ??
    (typeof transaccion['subscription'] === 'string'
      ? transaccion['subscription']
      : null)
  if (subId) {
    const sub = await estadoActual(
      suscripcionDe(reembolso['subscription']),
      subId
    )
    if (sub) await sincronizarSuscripcionCreem(admin, sub, null)
    return
  }

  const pagado = Number(transaccion['amount_paid'] ?? 0)
  const devuelto = Number(
    transaccion['refunded_amount'] ?? reembolso['refund_amount'] ?? 0
  )
  if (!(pagado > 0 && devuelto >= pagado)) return

  const checkout = esObjeto(reembolso['checkout']) ? reembolso['checkout'] : {}
  const meta = esObjeto(checkout['metadata']) ? checkout['metadata'] : null
  const pedido = esObjeto(reembolso['order']) ? reembolso['order'] : {}
  const productId =
    typeof pedido['product'] === 'string' ? pedido['product'] : null
  const metaPlan = textoMeta(meta, 'planId')
  const planId = esPlanKey(metaPlan) ? metaPlan : planDesdeProducto(productId)
  if (!planId || !esPagoUnico(planId)) return

  let userId = textoMeta(meta, 'userId')
  if (!esUuid(userId)) {
    const customerId =
      idCreem(reembolso['customer'] as string | null) ??
      (typeof pedido['customer'] === 'string' ? pedido['customer'] : null)
    if (!customerId) return
    const { data, error } = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    if (error) throw fallo('buscar por cliente', error)
    userId = (data as { user_id: string } | null)?.user_id ?? null
  }
  if (!esUuid(userId)) return

  const actual = await leerFilaUsuario(admin, userId)
  if (
    !actual ||
    actual.plan_id !== planId ||
    actual.stripe_subscription_id ||
    actual.source === 'admin'
  ) {
    return
  }
  await guardarFila(admin, {
    user_id: userId,
    plan_id: 'free',
    tier: 'free',
    status: 'canceled',
    current_period_end: new Date().toISOString(),
    cancel_at_period_end: false,
    source: 'creem',
  })
  trackSeguro(userId, 'pase_reembolsado', { planId, proveedor: 'creem' })
}

/** Procesa un evento ya verificado. Lanza si hay que reintentar. */
export async function procesarEventoCreem(
  admin: SupabaseClient,
  evento: EventoCreem
): Promise<void> {
  const objeto = evento.object
  if (evento.eventType === 'checkout.completed') {
    await alCompletarCheckout(admin, objeto as unknown as CreemCheckout)
    return
  }
  if (EVENTOS_SUSCRIPCION.has(evento.eventType)) {
    const copia = suscripcionDe(objeto)
    if (!copia) return
    const sub = await estadoActual(copia, copia.id)
    if (sub) await sincronizarSuscripcionCreem(admin, sub, null)
    return
  }
  if (evento.eventType === 'refund.created') {
    await alReembolsar(admin, objeto)
    return
  }
  if (evento.eventType === 'dispute.created') {
    // Creem gestiona la disputa como merchant of record; se deja constancia
    // para revisarla en su panel.
    registrarError('creem.webhook', `disputa abierta (${evento.id})`)
  }
}
