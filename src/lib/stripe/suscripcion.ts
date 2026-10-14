import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClientSafe } from '@/lib/supabase/admin'
import type { SubscriptionRow } from '@/types/database'

/**
 * Fila de subscriptions del usuario. Usa la service role si está configurada
 * y, si no, el cliente del propio usuario (la RLS subs_select le deja ver la
 * suya).
 */
export async function leerSuscripcion(
  supabaseUsuario: SupabaseClient,
  userId: string
): Promise<SubscriptionRow | null> {
  const cliente = createAdminClientSafe() ?? supabaseUsuario
  const { data } = await cliente
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as SubscriptionRow | null) ?? null
}

/** ¿Tiene una suscripción RECURRENTE de Stripe que todavía da acceso? */
export function tieneRecurrenteActiva(sub: SubscriptionRow | null): boolean {
  return Boolean(
    sub?.stripe_subscription_id &&
    sub.tier !== 'free' &&
    (sub.status === 'active' ||
      sub.status === 'trialing' ||
      sub.status === 'past_due')
  )
}
