import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ProfileRow } from '@/types/admin'

export interface AdminContext {
  userId: string
  email: string
  profile: ProfileRow
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
  if (!profile || profile.role !== 'admin') return null

  return { userId: user.id, email: profile.email ?? user.email ?? '', profile }
}

/**
 * Exige sesión admin. Redirige a /login si no hay sesión, o a / si el usuario
 * existe pero no es admin. Devuelve el contexto cuando pasa.
 * DEBE llamarse al inicio de cada página /admin y de cada server action admin.
 */
export async function requireAdmin(): Promise<AdminContext> {
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
  if (!profile || profile.role !== 'admin') redirect('/')

  return { userId: user.id, email: profile.email ?? user.email ?? '', profile }
}
