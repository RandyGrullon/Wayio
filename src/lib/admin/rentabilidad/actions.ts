'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { logAdminAction } from '@/lib/admin/audit'
import { esDueno } from '@/lib/admin/dueno'
import { mensajeError } from '@/lib/admin/errores'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/types/admin'
import { CLAVE_SUPUESTOS, esquemaSupuestos } from './supuestos'

/**
 * Guarda los supuestos de la calculadora de rentabilidad en la tabla PRIVADA
 * admin_private_settings (solo service role; migración 20261017130000).
 * Solo el dueño. En la auditoría quedan solo los NOMBRES de los campos
 * cambiados, nunca las cifras (los demás admins ven /admin/audit).
 */
export async function guardarSupuestosRentabilidad(
  entrada: unknown
): Promise<ActionResult> {
  const ctx = await requireAdmin()
  if (!esDueno(ctx.email)) {
    return {
      ok: false,
      error: 'Solo el dueño de Wayio puede cambiar estos supuestos.',
    }
  }

  const res = esquemaSupuestos.safeParse(entrada)
  if (!res.success) {
    const campo = res.error.issues[0]?.path.join('.') ?? ''
    return {
      ok: false,
      error: campo
        ? `Revisa el valor de «${campo}»: está fuera de rango.`
        : 'Los supuestos no son válidos.',
    }
  }
  const supuestos = res.data

  const admin = createAdminClient()
  const previo = await admin
    .from('admin_private_settings')
    .select('value')
    .eq('key', CLAVE_SUPUESTOS)
    .maybeSingle()
  if (previo.error) {
    return {
      ok: false,
      error: mensajeError(previo.error, 'guardarSupuestosRentabilidad', {
        esquema:
          'Falta aplicar la migración 20261017130000_cupos_y_rentabilidad.sql (tabla admin_private_settings).',
      }),
    }
  }

  const { error } = await admin.from('admin_private_settings').upsert(
    {
      key: CLAVE_SUPUESTOS,
      value: supuestos,
      updated_by: ctx.userId,
    },
    { onConflict: 'key' }
  )
  if (error) {
    return {
      ok: false,
      error: mensajeError(error, 'guardarSupuestosRentabilidad'),
    }
  }

  const anterior = (previo.data?.value ?? {}) as Record<string, unknown>
  const campos = Object.keys(supuestos).filter(
    (k) =>
      JSON.stringify(anterior[k]) !==
      JSON.stringify(supuestos[k as keyof typeof supuestos])
  )
  await logAdminAction(
    ctx,
    'set_rentabilidad_supuestos',
    'setting',
    CLAVE_SUPUESTOS,
    { campos }
  )
  revalidatePath('/admin/rentabilidad')
  return { ok: true }
}
