import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { esFaltaDeEsquema, registrarError } from '@/app/api/trips/_lib/http'
import type { SharedTripPayload } from '@/types/database'
import type { Trip } from '@/types/trip'

/**
 * Lee la versión pública de un viaje vía la RPC get_shared_trip con la ANON
 * key (sin service role y sin sesión): la función solo devuelve algo si el
 * dueño marcó el viaje como público, y nunca incluye grupo_link ni user_id.
 *
 * Devuelve el payload, null si no existe / no es público, o 'no_disponible'
 * si Supabase no está configurado o falta la migración.
 */
export async function leerViajeCompartido(
  id: string
): Promise<SharedTripPayload | null | 'no_disponible'> {
  if (!isSupabaseConfigured()) return 'no_disponible'

  const anon = createClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL'] as string,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] as string,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data, error } = await anon.rpc('get_shared_trip', { p_id: id })
  if (error) {
    if (esFaltaDeEsquema(error)) return 'no_disponible'
    registrarError('get_shared_trip', {
      code: error.code,
      message: error.message,
    })
    return 'no_disponible'
  }
  if (!data || typeof data !== 'object') return null

  const p = data as Record<string, unknown>
  if (typeof p['data'] !== 'object' || p['data'] === null) return null
  return {
    data: p['data'] as Trip,
    destino: typeof p['destino'] === 'string' ? p['destino'] : null,
    fecha_inicio:
      typeof p['fecha_inicio'] === 'string' ? p['fecha_inicio'] : null,
    fecha_fin: typeof p['fecha_fin'] === 'string' ? p['fecha_fin'] : null,
  }
}
