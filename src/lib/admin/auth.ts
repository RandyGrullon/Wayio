import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ProfileRow } from '@/types/admin'

export interface AdminContext {
  userId: string
  email: string
  profile: ProfileRow
}

/** ¿El perfil cuenta como admin? (rol admin y no baneado) */
function esAdmin(profile: ProfileRow | null): profile is ProfileRow {
  return Boolean(profile && profile.role === 'admin' && !profile.is_banned)
}

/** Devuelve el contexto admin o null (sin redirigir). Útil para checks suaves. */
export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = data as ProfileRow | null
  if (!esAdmin(profile)) return null

  return { userId: user.id, email: profile.email ?? user.email ?? '', profile }
}

/**
 * Exige sesión admin. Redirige a /login si no hay sesión, o a / si el usuario
 * existe pero no es admin (o está baneado). Devuelve el contexto cuando pasa.
 * Se llama en el layout de /admin, al inicio de CADA función de queries.ts
 * (patrón DAL: el chequeo vive junto a los datos, no solo en el layout) y de
 * cada server action admin. Con cache() la comprobación se hace una sola vez
 * por petición aunque una página llame a varias consultas.
 */
export const requireAdmin = cache(async (): Promise<AdminContext> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin')

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = data as ProfileRow | null
  if (!esAdmin(profile)) redirect('/')

  return { userId: user.id, email: profile.email ?? user.email ?? '', profile }
})
