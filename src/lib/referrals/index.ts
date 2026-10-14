import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { trackServerEvent } from '@/lib/analytics/posthog'
import type { ApplyReferralResult } from '@/types/database'

/**
 * Referidos. Toda la lógica sensible vive en la BD (RPC SECURITY DEFINER):
 *  - my_referral_code(): devuelve (o crea) el código del usuario actual. Es
 *    el ÚNICO generador de códigos (antes había dos formatos distintos).
 *  - apply_referral(code): canjea un código ajeno una sola vez, sin
 *    autorreferidos y con incremento atómico de conversions.
 * Las funciones reciben el cliente de la petición (cookies o Bearer móvil),
 * así que actúan como ese usuario.
 */

export interface ReferralInfo {
  code: string | null
  conversions: number
}

/** Analítica best-effort: sin key de PostHog o si falla, no hace nada. */
function trackSeguro(
  userId: string,
  event: string,
  properties: Record<string, unknown>
): void {
  if (!process.env['NEXT_PUBLIC_POSTHOG_KEY']) return
  try {
    trackServerEvent(userId, event, properties)
  } catch {
    // la analítica nunca debe romper la petición
  }
}

/** Código propio del usuario (lo crea si no tiene) y sus conversiones. */
export async function getOrCreateReferralCode(
  supabase: SupabaseClient,
  userId: string
): Promise<ReferralInfo> {
  const { data: fila } = await supabase
    .from('referrals')
    .select('code, conversions')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const existente = fila as { code: string; conversions: number } | null
  if (existente) {
    return { code: existente.code, conversions: existente.conversions }
  }

  const { data, error } = await supabase.rpc('my_referral_code')
  const code = !error && typeof data === 'string' ? data : null
  if (code) trackSeguro(userId, 'referral_created', { code })
  return { code, conversions: 0 }
}

export type ApplyResult = ApplyReferralResult | 'unavailable'

const RESULTADOS: readonly ApplyReferralResult[] = [
  'ok',
  'not_authenticated',
  'invalid_code',
  'self_referral',
  'already_redeemed',
  'not_eligible',
]

/** Canjea el código `code` para el usuario de la petición. */
export async function applyReferral(
  supabase: SupabaseClient,
  code: string,
  userId: string
): Promise<ApplyResult> {
  const { data, error } = await supabase.rpc('apply_referral', {
    p_code: code.trim().toUpperCase(),
  })
  if (error) return 'unavailable'

  const resultado = RESULTADOS.find((r) => r === data) ?? 'unavailable'
  if (resultado === 'ok') {
    trackSeguro(userId, 'referral_converted', { code: code.toUpperCase() })
  }
  return resultado
}
