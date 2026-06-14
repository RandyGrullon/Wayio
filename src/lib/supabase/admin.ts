import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireEnv } from '@/lib/utils/env'

/**
 * Cliente Supabase con SERVICE ROLE key. IGNORA RLS por completo, así que
 * SOLO debe usarse en código de servidor protegido por requireAdmin().
 * Nunca lo importes en componentes cliente.
 */
export function createAdminClient(): SupabaseClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

/** Igual que createAdminClient pero devuelve null si falta config (best-effort). */
export function createAdminClientSafe(): SupabaseClient | null {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
