import 'server-only'
import { createAdminClientSafe } from '@/lib/supabase/admin'
import type { PlanTier } from '@/types/subscription'
import type { SubscriptionRow } from '@/types/database'

/**
 * Plan efectivo de un usuario, calculado en el SERVIDOR (no confiar en el
 * cliente). Misma regla que la RPC my_effective_tier de la BD:
 *  - Suscripción recurrente (tiene stripe_subscription_id): manda el estado
 *    de Stripe; active, trialing y past_due (gracia) dan acceso.
 *  - Pago único ("Pro por viaje") o concedido a mano: además caduca al
 *    llegar current_period_end (si lo tiene).
 */
export function tierEfectivo(
  sub: Pick<
    SubscriptionRow,
    'tier' | 'status' | 'stripe_subscription_id' | 'current_period_end'
  > | null
): PlanTier {
  if (!sub) return 'free'
  const conAcceso =
    sub.status === 'active' ||
    sub.status === 'trialing' ||
    sub.status === 'past_due'
  if (!conAcceso) return 'free'
  if (sub.stripe_subscription_id) return sub.tier
  if (!sub.current_period_end) return sub.tier
  return Date.parse(sub.current_period_end) > Date.now() ? sub.tier : 'free'
}

/**
 * Lee la suscripción del usuario con la service role y devuelve su plan
 * efectivo. Sin service role configurada devuelve 'free' (degradación).
 * Pensado para que las rutas Pro/Grupo comprueben el plan en el servidor.
 */
export async function getEffectiveTier(userId: string): Promise<PlanTier> {
  const admin = createAdminClientSafe()
  if (!admin) return 'free'
  const { data, error } = await admin
    .from('subscriptions')
    .select('tier, status, stripe_subscription_id, current_period_end')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return 'free'
  return tierEfectivo(
    data as Pick<
      SubscriptionRow,
      'tier' | 'status' | 'stripe_subscription_id' | 'current_period_end'
    >
  )
}
