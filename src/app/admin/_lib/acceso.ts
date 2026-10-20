import 'server-only'
import { requireAdmin } from '@/lib/admin/auth'
import { esDueno, requireOwner } from '@/lib/admin/dueno'
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
  /** ¿Es el dueño? (WAYIO_OWNER_EMAILS; ve la calculadora de rentabilidad). */
  dueno: boolean
}

/** En la vista de ejemplo el admin es también el dueño (se ve todo). */
export const ADMIN_DEMO: SesionPanel = {
  userId: 'demo-admin',
  email: 'admin@ejemplo.com',
  demo: true,
  dueno: true,
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
  return {
    userId: ctx.userId,
    email: ctx.email,
    demo: false,
    dueno: esDueno(ctx.email),
  }
}

/**
 * Como exigirAdmin, pero solo para el dueño: a otro admin le responde 404
 * (requireOwner). Lo usan las páginas con cifras del negocio.
 */
export async function exigirDueno(): Promise<SesionPanel | null> {
  const modo = modoPanel()
  if (modo === 'demo') return ADMIN_DEMO
  if (modo === 'no-disponible') return null
  const ctx = await requireOwner()
  return { userId: ctx.userId, email: ctx.email, demo: false, dueno: true }
}
