import 'server-only'
import type Stripe from 'stripe'
import { PLANS, type PlanKey } from '@/constants/pricing'
import type { PlanId, PlanTier } from '@/types/subscription'

/**
 * Mapeos entre Stripe y la tabla subscriptions. Los precios se configuran en
 * Stripe y sus ids llegan por variables de entorno (STRIPE_PRICE_*).
 */

/** Estados que escribe el webhook (los 5 clásicos que conoce toda la app). */
export type EstadoGuardado =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'trialing'
  | 'incomplete'

export function esPlanKey(v: unknown): v is PlanKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PLANS, v)
}

export function tierDePlan(planId: PlanId): PlanTier {
  if (planId === 'pro_grupo') return 'grupo'
  if (planId === 'free') return 'free'
  return 'pro'
}

export function esPagoUnico(planId: PlanKey): boolean {
  return PLANS[planId].periodo === 'único'
}

/** Id del precio de Stripe de un plan (o null si falta la variable). */
export function precioDePlan(planId: PlanKey): string | null {
  return process.env[PLANS[planId].stripePriceEnv] || null
}

/** Plan correspondiente a un price id de Stripe (mapa inverso). */
export function planDesdePrecio(
  priceId: string | null | undefined
): PlanKey | null {
  if (!priceId) return null
  for (const key of Object.keys(PLANS) as PlanKey[]) {
    if (precioDePlan(key) === priceId) return key
  }
  return null
}

/**
 * Mapea el estado de Stripe a los 5 que conoce la app (DA-17):
 *   unpaid / incomplete_expired → canceled (sin acceso; si luego paga, el
 *   evento customer.subscription.updated lo reactiva), paused → past_due.
 */
export function mapearEstado(
  status: Stripe.Subscription.Status
): EstadoGuardado {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'incomplete':
    case 'canceled':
      return status
    case 'paused':
      return 'past_due'
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled'
    default:
      return 'incomplete'
  }
}

/**
 * ¿El estado de Stripe da acceso a las funciones del plan? past_due conserva
 * el acceso mientras Stripe reintenta el cobro (periodo de gracia).
 */
export function estadoConAcceso(status: Stripe.Subscription.Status): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due'
}

/** Segundos epoch de Stripe → ISO, o null. */
export function epochAIso(segundos: number | null | undefined): string | null {
  if (typeof segundos !== 'number' || !Number.isFinite(segundos)) return null
  return new Date(segundos * 1000).toISOString()
}
