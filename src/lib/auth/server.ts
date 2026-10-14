import 'server-only'
import { cookies, headers } from 'next/headers'
import { getBaseUrl } from '@/lib/utils/baseUrl'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { RECOVERY_COOKIE, RECOVERY_COOKIE_MAX_AGE } from '@/lib/auth/constants'

/**
 * Origen público (https://host) desde el que el usuario hizo la petición.
 *
 * En server actions Next.js ya exige que Origin coincida con Host, así que es
 * de fiar; y usar el mismo origen hace que la vuelta de Google/email caiga en
 * el host donde está la cookie PKCE (www vs. sin www, previews...). Si falta,
 * se usa la URL base configurada.
 */
export async function origenDeLaPeticion(): Promise<string> {
  const h = await headers()
  const origin = h.get('origin')
  if (origin) {
    try {
      const u = new URL(origin)
      if (u.protocol === 'https:' || u.protocol === 'http:') return u.origin
    } catch {
      // Origin mal formado: seguimos con la URL base.
    }
  }
  return getBaseUrl()
}

/** IP del cliente (detrás de Vercel/proxy) para el rate limit de las actions. */
export async function ipDeLaPeticion(): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || h.get('x-real-ip') || 'anon'
}

/** Marca la sesión actual como recién recuperada (enlace de recovery/invite). */
export async function marcarRecuperacion(userId: string): Promise<void> {
  const store = await cookies()
  store.set(RECOVERY_COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: RECOVERY_COOKIE_MAX_AGE,
  })
}

export async function limpiarRecuperacion(): Promise<void> {
  const store = await cookies()
  if (store.get(RECOVERY_COOKIE)) store.delete(RECOVERY_COOKIE)
}

/**
 * Id del usuario si hay una sesión de recuperación válida: sesión de Supabase
 * activa + marca de recuperación de ESE usuario. Si no, null.
 */
export async function usuarioEnRecuperacion(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const store = await cookies()
  const marca = store.get(RECOVERY_COOKIE)?.value
  if (!marca) return null
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  return id && id === marca ? id : null
}
