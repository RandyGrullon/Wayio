/**
 * Invitaciones (src/app/cuenta/Referidos.tsx de la web) con /api/referrals y
 * el Bearer de la sesión (lib/api/http.ts):
 * - GET  → { code, conversions }: tu código de invitación.
 * - POST { code } → { ok, mensaje } | { ok: false, error, code }: canjear el
 *   código de otra persona (solo una vez y en cuentas nuevas).
 */
import { config } from '../../config'
import { getJSON, postJSON } from './http'

export interface MiCodigo {
  code: string
  /** Personas que se unieron con tu código. */
  conversions: number
}

/** Formato que acepta el servidor (4 a 32 letras, números, - o _). */
export const CODIGO_RE = /^[A-Za-z0-9_-]{4,32}$/

const SIN_CODIGO = 'Tu código de invitación no está disponible ahora mismo.'

/** Tu código. Lanza BackendError (o Error) con un texto apto para mostrar. */
export async function getMiCodigo(): Promise<MiCodigo> {
  const r = await getJSON<{ code?: unknown; conversions?: unknown }>(
    '/api/referrals',
    { requiereSesion: true, timeoutMs: 20_000 }
  )
  if (typeof r.code !== 'string' || !r.code) throw new Error(SIN_CODIGO)
  return {
    code: r.code,
    conversions:
      typeof r.conversions === 'number' && Number.isFinite(r.conversions)
        ? r.conversions
        : 0,
  }
}

/** Canjea el código de otra persona y devuelve el mensaje del servidor. */
export async function canjearCodigo(code: string): Promise<string> {
  const r = await postJSON<{ ok?: unknown; mensaje?: unknown }>(
    '/api/referrals',
    { code: code.trim() },
    { requiereSesion: true, timeoutMs: 20_000 }
  )
  return typeof r.mensaje === 'string' && r.mensaje
    ? r.mensaje
    : 'Código de invitación aplicado.'
}

/**
 * Texto para compartir tu código con la hoja nativa. Con EXPO_PUBLIC_WEB_URL
 * lleva el enlace para crear la cuenta en la web (/login?modo=registro); el
 * código se escribe después en «Invitaciones» (web o app).
 */
export function mensajeInvitacion(code: string): string {
  const base = `Te invito a Wayio, el planificador de viajes con IA. Crea tu cuenta y escribe mi código de invitación: ${code}`
  return config.webUrl ? `${base}\n${config.webUrl}/login?modo=registro` : base
}
