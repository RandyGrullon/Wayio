import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Proxy (antes "middleware"): exige sesión en las páginas privadas y refresca
 * la cookie de Supabase. Las rutas /api/** NO pasan por aquí: cada una
 * comprueba su propia sesión (cookie o Bearer) y responde 401 en JSON.
 */

/** Páginas que requieren sesión (la ruta y todo lo que cuelga de ella). */
const PROTECTED_PREFIXES = ['/trip', '/group', '/admin', '/cuenta']

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? ''

function esProtegida(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request })

  // Modo demo: sin Supabase no protegemos rutas (la app se puede navegar)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return response

  return withAuth(request, response)
}

async function withAuth(
  request: NextRequest,
  initialResponse: NextResponse
): Promise<NextResponse> {
  let response = initialResponse

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
        // Supabase pide que una respuesta que renueva la sesión no la cachee
        // ningún CDN (si no, la cookie de un usuario podría servirse a otro).
        Object.entries(headers).forEach(([clave, valor]) =>
          response.headers.set(clave, valor)
        )
      },
    },
  })

  let hayUsuario = false
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    hayUsuario = Boolean(user)
  } catch {
    // Si Supabase no responde, lo seguro es tratarlo como sin sesión.
    hayUsuario = false
  }

  const { pathname, search } = request.nextUrl

  if (esProtegida(pathname) && !hayUsuario) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.search = ''
    redirectUrl.searchParams.set('redirect', `${pathname}${search}`)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: ['/trip/:path*', '/group/:path*', '/admin/:path*', '/cuenta/:path*'],
}
