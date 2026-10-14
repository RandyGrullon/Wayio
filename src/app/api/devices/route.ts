import { z } from 'zod'
import {
  autenticar,
  errorDb,
  errorJson,
  esFaltaDeEsquema,
  leerJson,
  okJson,
} from '@/app/api/trips/_lib/http'
import { rateLimit, tooManyRequests } from '@/lib/security/rateLimit'

const RegisterSchema = z.object({
  token: z.string().trim().min(1).max(512),
  platform: z.enum(['ios', 'android', 'web']),
})

const UnregisterSchema = z.object({
  token: z.string().trim().min(1).max(512),
})

/**
 * POST /api/devices — registra el token push del dispositivo (mobile/web).
 * Acepta sesión por cookies o `Authorization: Bearer` (mobile).
 * Body: { token, platform: 'ios'|'android'|'web' }. Respuesta: { ok: true }
 *
 * Usa la RPC register_device: si el token ya era de otra cuenta (cambio de
 * sesión en el mismo teléfono) pasa a la actual en vez de fallar por RLS.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const limite = await rateLimit({
    bucket: 'devices',
    id: user.id,
    limit: 20,
    windowSec: 600,
  })
  if (!limite.ok) return tooManyRequests(limite)

  const leido = await leerJson(request, 2_000)
  if (!leido.ok) return leido.response
  const parsed = RegisterSchema.safeParse(leido.body)
  if (!parsed.success) {
    return errorJson(
      400,
      'Los datos del dispositivo no son válidos.',
      'invalid_device'
    )
  }

  const { error } = await supabase.rpc('register_device', {
    p_token: parsed.data.token,
    p_platform: parsed.data.platform,
  })
  if (!error) return okJson({ ok: true })

  // Sin la migración: comportamiento anterior (upsert de la fila propia).
  if (esFaltaDeEsquema(error)) {
    const { error: errUpsert } = await supabase.from('device_tokens').upsert(
      {
        user_id: user.id,
        token: parsed.data.token,
        platform: parsed.data.platform,
      },
      { onConflict: 'token' }
    )
    if (!errUpsert) return okJson({ ok: true })
    return errorDb(errUpsert, 'devices.upsert')
  }
  return errorDb(error, 'devices.register')
}

/**
 * DELETE /api/devices — da de baja el token (p. ej. al cerrar sesión).
 * Body: { token }. Respuesta: { ok: true }
 */
export async function DELETE(request: Request): Promise<Response> {
  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const leido = await leerJson(request, 2_000)
  if (!leido.ok) return leido.response
  const parsed = UnregisterSchema.safeParse(leido.body)
  if (!parsed.success) {
    return errorJson(
      400,
      'Los datos del dispositivo no son válidos.',
      'invalid_device'
    )
  }

  const { error } = await supabase
    .from('device_tokens')
    .delete()
    .eq('token', parsed.data.token)
    .eq('user_id', user.id)
  if (error) return errorDb(error, 'devices.delete')
  return okJson({ ok: true })
}
