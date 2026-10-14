import { z } from 'zod'
import {
  autenticar,
  errorJson,
  leerJson,
  okJson,
} from '@/app/api/trips/_lib/http'
import { applyReferral, getOrCreateReferralCode } from '@/lib/referrals'
import { rateLimit, tooManyRequests } from '@/lib/security/rateLimit'

/**
 * GET /api/referrals — tu código de invitación.
 * Respuesta: { code: string | null, conversions: number }
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const info = await getOrCreateReferralCode(supabase, user.id)
  if (!info.code) {
    return errorJson(
      503,
      'Tu código de invitación no está disponible ahora mismo. Inténtalo más tarde.',
      'referrals_unavailable'
    )
  }
  return okJson(info)
}

const BodySchema = z.object({
  code: z
    .string()
    .trim()
    .min(4)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/),
})

const RESPUESTAS = {
  invalid_code: { status: 404, mensaje: 'Ese código de invitación no existe.' },
  self_referral: {
    status: 400,
    mensaje: 'No puedes usar tu propio código de invitación.',
  },
  already_redeemed: {
    status: 409,
    mensaje: 'Ya usaste un código de invitación en tu cuenta.',
  },
  not_eligible: {
    status: 400,
    mensaje: 'Los códigos de invitación solo pueden usarse en cuentas nuevas.',
  },
  not_authenticated: { status: 401, mensaje: 'Inicia sesión para continuar.' },
  unavailable: {
    status: 503,
    mensaje:
      'Las invitaciones no están disponibles ahora mismo. Inténtalo más tarde.',
  },
} as const

/**
 * POST /api/referrals — canjea el código de invitación de otra persona.
 * Body: { code: string }
 * Respuesta 200: { ok: true, mensaje }
 * Errores: { ok: false, error: <mensaje>, code: invalid_code | self_referral |
 *   already_redeemed | not_eligible | unavailable }
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const limite = await rateLimit({
    bucket: 'referral-apply',
    id: user.id,
    limit: 10,
    windowSec: 3600,
  })
  if (!limite.ok) return tooManyRequests(limite)

  const leido = await leerJson(request, 1_000)
  if (!leido.ok) return leido.response
  const parsed = BodySchema.safeParse(leido.body)
  if (!parsed.success) {
    return errorJson(
      400,
      'Escribe un código de invitación válido.',
      'invalid_code',
      {
        ok: false,
      }
    )
  }

  const resultado = await applyReferral(supabase, parsed.data.code, user.id)
  if (resultado === 'ok') {
    return okJson({
      ok: true,
      mensaje: '¡Listo! Código de invitación aplicado.',
    })
  }
  const r = RESPUESTAS[resultado]
  return errorJson(r.status, r.mensaje, resultado, { ok: false })
}
