import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { esFaltaDeEsquema, registrarError } from '@/app/api/trips/_lib/http'
import type { PlanKey } from '@/constants/pricing'
import { trackServerEvent } from '@/lib/analytics/posthog'
import { tierDePlan } from '@/lib/stripe/plans'
import type { SubscriptionRow, SubscriptionSource } from '@/types/database'

/**
 * Escrituras en `subscriptions` que comparten los webhooks de todos los
 * proveedores de cobro (Stripe y Creem): misma fila por usuario, mismo pase de
 * pago único y mismas reglas. Siempre con la SERVICE ROLE (el webhook no trae
 * sesión y la RLS bloquearía la escritura).
 */

export const DIA_MS = 86_400_000

export type FilaSuscripcion = Partial<SubscriptionRow> & { user_id: string }

/** Error de Supabase → Error (el webhook responde 500 y el proveedor reintenta). */
export function fallo(
  contexto: string,
  error: { code?: string; message?: string }
): Error {
  return new Error(
    `${contexto}: ${error.code ?? ''} ${error.message ?? ''}`.trim()
  )
}

/** Evento de analítica que nunca tumba el webhook. */
export function trackSeguro(
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

export async function leerFilaUsuario(
  admin: SupabaseClient,
  userId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw fallo('leer suscripción', error)
  return (data as SubscriptionRow | null) ?? null
}

/**
 * Upsert por user_id. Si la columna source no existe (sin migración) o su
 * CHECK todavía no admite el valor (sin la migración de Creem), reintenta sin
 * ella: el plan se activa igual y el origen se deduce del id del cliente.
 */
export async function guardarFila(
  admin: SupabaseClient,
  fila: FilaSuscripcion
): Promise<void> {
  const { error } = await admin
    .from('subscriptions')
    .upsert(fila, { onConflict: 'user_id' })
  if (!error) return
  const sinColumna = esFaltaDeEsquema(error)
  const checkViejo = error.code === '23514' && fila.source === 'creem'
  if ((sinColumna || checkViejo) && 'source' in fila) {
    if (checkViejo) {
      registrarError(
        'pagos.guardarFila',
        "subscriptions_source_check no admite 'creem': ejecuta la migración 20261105120000_cobros_creem.sql"
      )
    }
    const sinSource: FilaSuscripcion = { ...fila }
    delete sinSource.source
    const { error: error2 } = await admin
      .from('subscriptions')
      .upsert(sinSource, { onConflict: 'user_id' })
    if (!error2) return
    throw fallo('guardar suscripción', error2)
  }
  throw fallo('guardar suscripción', error)
}

/**
 * Fin del pase de pago único: 30 días desde el pago o, si el checkout trae el
 * viaje del usuario, el fin del viaje + 7 días. Siempre entre 7 y 365 días
 * desde el pago (`desde`), así reprocesar el mismo pago da la misma fecha.
 */
export async function finPaseUnico(
  admin: SupabaseClient,
  userId: string,
  tripId: string | null,
  desde: number = Date.now()
): Promise<number> {
  let fin = desde + 30 * DIA_MS
  if (tripId) {
    const { data, error } = await admin
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
  return Math.min(Math.max(fin, desde + 7 * DIA_MS), desde + 365 * DIA_MS)
}

export interface DatosPase {
  userId: string
  planId: PlanKey
  customerId: string | null
  tripId: string | null
  /** Proveedor que cobró el pase. */
  source: Extract<SubscriptionSource, 'stripe' | 'creem'>
  /** Precio (Stripe) o producto (Creem) cobrado, para stripe_price_id. */
  precioRef: string | null
  /** Momento del pago (ms). Por defecto, ahora. */
  desde?: number
  /** Contexto para el registro de errores. */
  contexto: string
}

/**
 * DECISIÓN «Pro por viaje» / Pase Pro (pago único, MON-04): NO concede Pro
 * permanente. Activa tier 'pro' hasta finPaseUnico(). Comprar otro pase
 * extiende la fecha (no la acorta). No pisa una suscripción recurrente activa.
 */
export async function activarPaseUnico(
  admin: SupabaseClient,
  datos: DatosPase
): Promise<void> {
  const actual = await leerFilaUsuario(admin, datos.userId)

  // Ya paga una suscripción recurrente con acceso: no se le cambia el plan.
  if (
    actual?.stripe_subscription_id &&
    actual.tier !== 'free' &&
    (actual.status === 'active' ||
      actual.status === 'trialing' ||
      actual.status === 'past_due')
  ) {
    registrarError(
      datos.contexto,
      `pase ${datos.planId} de ${datos.userId} con suscripción activa: plan sin cambios`
    )
    if (datos.customerId && !actual.stripe_customer_id) {
      await guardarFila(admin, {
        user_id: datos.userId,
        stripe_customer_id: datos.customerId,
      })
    }
    return
  }

  const fin = await finPaseUnico(
    admin,
    datos.userId,
    datos.tripId,
    datos.desde ?? Date.now()
  )
  const finActual =
    actual?.plan_id === datos.planId && actual.current_period_end
      ? Date.parse(actual.current_period_end)
      : 0
  const finFinal = Math.max(fin, Number.isFinite(finActual) ? finActual : 0)

  await guardarFila(admin, {
    user_id: datos.userId,
    plan_id: datos.planId,
    tier: tierDePlan(datos.planId),
    status: 'active',
    stripe_subscription_id: null,
    stripe_price_id: datos.precioRef,
    current_period_end: new Date(finFinal).toISOString(),
    cancel_at_period_end: false,
    source: datos.source,
    ...(datos.customerId ? { stripe_customer_id: datos.customerId } : {}),
  })
}
