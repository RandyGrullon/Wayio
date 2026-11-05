import 'server-only'
import { createAdminClientSafe } from '@/lib/supabase/admin'
import type { PlanTier } from '@/types/subscription'
import type { SubscriptionRow } from '@/types/database'

/**
 * Margen tras current_period_end en las compras de la tienda: cubre la demora
 * entre la renovación y el webhook de RevenueCat (y sus reintentos). Igual
 * que el `interval '3 hours'` de la RPC my_effective_tier.
 */
export const GRACIA_TIENDA_MS = 3 * 3_600_000

/** Campos de subscriptions con los que se calcula el plan efectivo. */
export type FilaPlan = Pick<
  SubscriptionRow,
  'tier' | 'status' | 'stripe_subscription_id' | 'current_period_end'
> & { source?: string | null | undefined }

/** ¿El plan lo cobró una tienda (App Store o Google Play)? */
export function esDeTienda(source: string | null | undefined): boolean {
  return source === 'app_store' || source === 'play_store'
}

/**
 * Plan efectivo de un usuario, calculado en el SERVIDOR (no confiar en el
 * cliente). Misma regla que la RPC my_effective_tier de la BD:
 *  - Solo active, trialing y past_due (gracia) dan acceso.
 *  - Compra de la tienda (source app_store / play_store): hasta
 *    current_period_end + GRACIA_TIENDA_MS (el webhook de RevenueCat escribe
 *    el fin en cada renovación, cancelación, reembolso o caducidad).
 *  - Suscripción recurrente web (tiene stripe_subscription_id, que guarda el
 *    id del proveedor: Stripe o Creem): manda el estado del proveedor.
 *  - Pago único ("Pase Pro de 30 días") o concedido a mano: además caduca al
 *    llegar current_period_end (si lo tiene).
 */
export function tierEfectivo(sub: FilaPlan | null): PlanTier {
  if (!sub) return 'free'
  const conAcceso =
    sub.status === 'active' ||
    sub.status === 'trialing' ||
    sub.status === 'past_due'
  if (!conAcceso) return 'free'
  if (esDeTienda(sub.source)) {
    const fin = sub.current_period_end
      ? Date.parse(sub.current_period_end)
      : Number.NaN
    return Number.isFinite(fin) && fin + GRACIA_TIENDA_MS > Date.now()
      ? sub.tier
      : 'free'
  }
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
  // '*' y no una lista: así incluye `source` si la columna existe y no falla
  // si falta alguna migración.
  const { data, error } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return 'free'
  return tierEfectivo(data as FilaPlan)
}
