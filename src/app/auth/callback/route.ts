import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { NUEVA_CLAVE_PATH } from '@/lib/auth/constants'
import { destinoSeguro } from '@/lib/auth/redirect'
import { marcarRecuperacion } from '@/lib/auth/server'

/**
 * Vuelta de Google OAuth (y de enlaces de email PKCE con las plantillas por
 * defecto de Supabase): canjea el `code` por sesión y redirige a `next`
 * validado (solo rutas internas: sin open redirect).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl
  const ir = (path: string): NextResponse =>
    NextResponse.redirect(new URL(path, origin))

  // El proveedor devolvió un error (p. ej. el usuario canceló en Google).
  if (searchParams.get('error') || searchParams.get('error_code')) {
    return ir('/login?error=oauth')
  }
  if (!isSupabaseConfigured()) return ir('/login?error=config')

  const code = searchParams.get('code')
  if (!code) return ir('/login?error=auth')

  const next = destinoSeguro(searchParams.get('next'))
  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) return ir('/login?error=auth')

  if (next === NUEVA_CLAVE_PATH) await marcarRecuperacion(data.user.id)
  return ir(next)
}
