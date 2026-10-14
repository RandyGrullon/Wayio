import 'server-only'
import { requireAdmin } from '@/lib/admin/auth'
import { isSupabaseConfigured } from '@/lib/supabase/config'

/**
 * Acceso al panel.
 *
 * - 'real': Supabase y la service role están configurados → requireAdmin()
 *   (redirige a /login o a / si no hay sesión de admin).
 * - 'demo': solo en desarrollo y sin base de datos: datos de ejemplo
 *   claramente señalados para poder diseñar y revisar el panel. Las acciones
 *   no se ejecutan.
 * - 'no-disponible': en producción sin base de datos no se muestra nada.
 */
export type ModoPanel = 'real' | 'demo' | 'no-disponible'

export function modoPanel(): ModoPanel {
  const configurado =
    isSupabaseConfigured() && Boolean(process.env['SUPABASE_SERVICE_ROLE_KEY'])
  if (configurado) return 'real'
  return process.env.NODE_ENV === 'development' ? 'demo' : 'no-disponible'
}

export interface SesionPanel {
  userId: string
  email: string
  demo: boolean
}

export const ADMIN_DEMO: SesionPanel = {
  userId: 'demo-admin',
  email: 'admin@ejemplo.com',
  demo: true,
}

/**
 * Lo llama el layout Y cada página (patrón DAL de auth.ts: el control vive
 * junto a los datos). requireAdmin() está envuelto en cache(), así que la
 * comprobación se hace una sola vez por petición.
 */
export async function exigirAdmin(): Promise<SesionPanel | null> {
  const modo = modoPanel()
  if (modo === 'demo') return ADMIN_DEMO
  if (modo === 'no-disponible') return null
  const ctx = await requireAdmin()
  return { userId: ctx.userId, email: ctx.email, demo: false }
}
