import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/trip/', '/group/', '/admin']

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? ''

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
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: ['/trip/:path*', '/group/:path*', '/admin/:path*'],
}
