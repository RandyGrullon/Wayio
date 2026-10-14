import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getBaseUrl } from '@/lib/utils/baseUrl'
import {
  NUEVA_CLAVE_PATH,
  RECUPERAR_PATH,
  tipoOtpValido,
} from '@/lib/auth/constants'
import {
  esDestinoApp,
  resolverDestino,
  tokenHashValido,
} from '@/lib/auth/redirect'
import { marcarRecuperacion } from '@/lib/auth/server'

/**
 * Destino de los enlaces de los correos de auth (plantillas de
 * supabase/templates):
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<tipo>&next=...
 *
 * Verifica el token con verifyOtp, que (a diferencia del canje PKCE) funciona
 * aunque el correo se abra en otro dispositivo o navegador. Después:
 *  - recovery / invite → /auth/nueva-clave (elegir contraseña),
 *  - enlace pedido desde la app (next=wayio://..., salvo recovery/invite) →
 *    /auth/abrir-app, que pasa el token a la app para que sea ella quien
 *    inicie sesión,
 *  - resto → `next` validado (solo rutas internas o URLs de este sitio).
 *
 * También acepta ?code= (plantillas por defecto de Supabase con PKCE, mismo
 * navegador) como respaldo.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl
  const ir = (path: string): NextResponse =>
    NextResponse.redirect(new URL(path, origin))

  const tipo = tipoOtpValido(searchParams.get('type'))
  const rawTokenHash = searchParams.get('token_hash')
  const tokenHash = tokenHashValido(rawTokenHash) ? rawTokenHash : null
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next')
  const paginaDeError =
    tipo === 'recovery'
      ? `${RECUPERAR_PATH}?error=enlace`
      : '/login?error=enlace'

  // Supabase redirige con ?error=... cuando el enlace caducó o ya se usó.
  if (searchParams.get('error') || searchParams.get('error_code')) {
    return ir(paginaDeError)
  }
  // Enlace pedido desde la app móvil: la web no lo consume; se lo pasa a la app
  // (no necesita Supabase en la web). Recuperación e invitación, que terminan
  // eligiendo contraseña, se completan siempre en la web.
  const terminaEnNuevaClave = tipo === 'recovery' || tipo === 'invite'
  if (tokenHash && tipo && !terminaEnNuevaClave && esDestinoApp(rawNext)) {
    const url = new URL('/auth/abrir-app', origin)
    url.searchParams.set('token_hash', tokenHash)
    url.searchParams.set('type', tipo)
    return NextResponse.redirect(url)
  }

  if (!isSupabaseConfigured()) return ir('/login?error=config')

  const supabase = await createClient()
  let ok = false
  let userId: string | null = null
  if (tokenHash && tipo) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: tipo,
      token_hash: tokenHash,
    })
    ok = !error
    userId = data.user?.id ?? null
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
    userId = data.user?.id ?? null
  }
  // En el cambio de email con doble confirmación, el primer enlace se acepta
  // sin devolver usuario: es correcto y no hay sesión que crear.
  if (!ok) return ir(paginaDeError)

  const destino = terminaEnNuevaClave
    ? NUEVA_CLAVE_PATH
    : resolverDestino(rawNext, [origin, new URL(getBaseUrl()).origin])

  if (destino === NUEVA_CLAVE_PATH) {
    if (!userId) return ir(paginaDeError)
    await marcarRecuperacion(userId)
  }
  return ir(destino)
}
