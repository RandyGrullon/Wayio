import 'server-only'
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js'
import { createClient as createCookieClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

/**
 * Cliente Supabase para una petición a una API route, que acepta:
 *  - la sesión por cookies (web), o
 *  - `Authorization: Bearer <access_token>` (app móvil, que no tiene cookies).
 *
 * El cliente resultante actúa COMO ese usuario (RLS aplicada). Devuelve
 * user=null si no hay sesión válida o Supabase no está configurado.
 */
export async function getRequestAuth(request: Request): Promise<{
  supabase: SupabaseClient | null
  user: User | null
}> {
  if (!isSupabaseConfigured()) return { supabase: null, user: null }

  const auth = request.headers.get('authorization') ?? ''
  const bearer = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim()

  if (bearer) {
    const supabase = createSupabaseClient(
      process.env['NEXT_PUBLIC_SUPABASE_URL'] as string,
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] as string,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      }
    )
    const { data, error } = await supabase.auth.getUser(bearer)
    return { supabase, user: error ? null : data.user }
  }

  const supabase = await createCookieClient()
  const { data } = await supabase.auth.getUser()
  return { supabase, user: data.user ?? null }
}

/** Solo el usuario (o null) de la petición. */
export async function getRequestUser(request: Request): Promise<User | null> {
  return (await getRequestAuth(request)).user
}
