import 'server-only'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { requireAdmin, type AdminContext } from './auth'

/**
 * «Dueño» del panel: el admin que puede ver las cifras del negocio (la
 * calculadora de rentabilidad: comisiones, costos fijos, márgenes).
 *
 * WAYIO_OWNER_EMAILS (variable SOLO de servidor, nunca NEXT_PUBLIC_): correos
 * separados por coma, sin distinguir mayúsculas. Si NO está definida (o está
 * vacía), cualquier admin cuenta como dueño, para no dejar la sección
 * inaccesible en un despliegue sin configurar.
 *
 * El correo que se compara es el del perfil (profiles.email, que solo escribe
 * la service role: un usuario no puede editarlo desde el navegador) o, si
 * falta, el de Supabase Auth.
 */

function correosDueno(): ReadonlySet<string> | null {
  const crudo = process.env['WAYIO_OWNER_EMAILS']?.trim()
  if (!crudo) return null
  const correos = crudo
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
  return correos.length > 0 ? new Set(correos) : null
}

/** ¿Este correo de admin es del dueño? (sin la variable, todo admin lo es). */
export function esDueno(email: string | null | undefined): boolean {
  const correos = correosDueno()
  if (!correos) return true
  const normalizado = email?.trim().toLowerCase()
  return Boolean(normalizado && correos.has(normalizado))
}

/**
 * Exige sesión de admin (requireAdmin: redirige a /login o a /) y, además,
 * que sea el dueño. A un admin que no lo es le responde 404: la sección no
 * existe para él. Se llama en la página, en cada consulta y en la server
 * action de la calculadora (patrón DAL de auth.ts).
 */
export const requireOwner = cache(async (): Promise<AdminContext> => {
  const ctx = await requireAdmin()
  if (!esDueno(ctx.email)) notFound()
  return ctx
})
