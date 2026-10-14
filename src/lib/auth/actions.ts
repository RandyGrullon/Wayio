'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { rateLimit } from '@/lib/security/rateLimit'
import {
  NUEVA_CLAVE_PATH,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from '@/lib/auth/constants'
import {
  MENSAJE_ENLACE,
  MENSAJE_LIMITE,
  MENSAJE_NO_CONFIGURADO,
  traducirErrorAuth,
} from '@/lib/auth/mensajes'
import { destinoSeguro } from '@/lib/auth/redirect'
import {
  ipDeLaPeticion,
  limpiarRecuperacion,
  origenDeLaPeticion,
  usuarioEnRecuperacion,
} from '@/lib/auth/server'
import type { AuthResult } from '@/lib/auth/types'

/*
 * Server actions de autenticación (web). Todas devuelven mensajes en español
 * aptos para el usuario y degradan con gracia si Supabase no está configurado.
 * Los destinos tras autenticarse se validan siempre (sin open redirects).
 */

const EmailSchema = z.email()

const MENSAJE_EMAIL_ENVIADO_RESET =
  'Si existe una cuenta con ese email, te enviamos un enlace para crear una contraseña nueva. Revisa tu bandeja de entrada (y la carpeta de spam).'

const MENSAJE_EMAIL_ENVIADO_MAGIC =
  'Si tu email está registrado, te enviamos un enlace para entrar sin contraseña. Revisa tu bandeja de entrada (y la carpeta de spam).'

const MENSAJE_EMAIL_REENVIADO =
  'Si tu cuenta está pendiente de confirmar, te enviamos de nuevo el correo. Revisa tu bandeja de entrada (y la carpeta de spam).'

const MENSAJE_ENVIO_FALLIDO =
  'No pudimos enviar el correo ahora mismo. Inténtalo de nuevo en unos minutos.'

function noConfigurado(): AuthResult {
  return { error: MENSAJE_NO_CONFIGURADO, code: 'no_configurado' }
}

function invalido(mensaje: string): AuthResult {
  return { error: mensaje, code: 'validacion' }
}

function desdeError(
  error: {
    code?: string | undefined
    message?: string
    status?: number | undefined
  } | null
): AuthResult {
  const t = traducirErrorAuth(error)
  return { error: t.mensaje, code: t.code }
}

function normalizarEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const v = email.trim().toLowerCase()
  if (v.length > 254) return null
  return EmailSchema.safeParse(v).success ? v : null
}

function validarPasswordNueva(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`
  }
  // bcrypt cuenta bytes, no caracteres: las tildes y los emojis ocupan más de
  // uno, y Supabase rechaza más de 72 bytes con un error poco claro.
  if (
    password.length > PASSWORD_MAX ||
    new TextEncoder().encode(password).length > PASSWORD_MAX
  ) {
    return `La contraseña es demasiado larga: usa como máximo ${PASSWORD_MAX} caracteres (menos si lleva tildes o emojis).`
  }
  if (password.trim().length === 0) {
    return 'La contraseña no puede ser solo espacios.'
  }
  return null
}

/** Rate limit por IP; devuelve el resultado de error si se superó. */
async function limitar(
  bucket: string,
  limit: number,
  windowSec: number
): Promise<AuthResult | null> {
  const r = await rateLimit({
    bucket,
    id: await ipDeLaPeticion(),
    limit,
    windowSec,
  })
  return r.ok ? null : { error: MENSAJE_LIMITE, code: 'limite' }
}

/** ¿Error del servidor/red (no imputable a los datos del usuario)? */
function esFalloDeEnvio(
  error: { status?: number | undefined } | null
): boolean {
  if (!error) return false
  return error.status === undefined || error.status === 0 || error.status >= 500
}

/** URL a la que vuelven los enlaces de email de la web. */
async function urlDeConfirmacion(next: string): Promise<string> {
  const origin = await origenDeLaPeticion()
  return `${origin}/auth/confirm?next=${encodeURIComponent(next)}`
}

// ---------------------------------------------------------------------------
// Inicio de sesión
// ---------------------------------------------------------------------------

/**
 * Login con Google (OAuth PKCE). Si todo va bien redirige a Google y, al
 * volver, /auth/callback lleva al usuario a `redirectTo` (validado).
 */
export async function signInWithGoogle(
  redirectTo?: string
): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return noConfigurado()
  const next = destinoSeguro(redirectTo)
  const origin = await origenDeLaPeticion()

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })
  if (error || !data.url) return desdeError(error)
  redirect(data.url)
}

/** Login con email y contraseña; si sale bien redirige a `redirectTo` (validado). */
export async function signInWithEmail(
  email: string,
  password: string,
  redirectTo?: string
): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return noConfigurado()
  const correo = normalizarEmail(email)
  if (!correo) return invalido('Escribe un email válido.')
  if (typeof password !== 'string' || password.length === 0) {
    return invalido('Escribe tu contraseña.')
  }
  const limite = await limitar('auth-login', 20, 10 * 60)
  if (limite) return limite

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: correo,
    password,
  })
  if (error) return desdeError(error)
  redirect(destinoSeguro(redirectTo))
}

/**
 * Registro con email y contraseña. El correo de confirmación vuelve a
 * /auth/confirm (funciona aunque se abra en otro dispositivo) y de ahí a
 * `redirectTo`. Si el proyecto no exige confirmar el email, entra directo.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  nombre: string,
  redirectTo?: string
): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return noConfigurado()
  const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : ''
  if (nombreLimpio.length === 0) return invalido('Escribe tu nombre.')
  if (nombreLimpio.length > 80) {
    return invalido('El nombre puede tener como máximo 80 caracteres.')
  }
  const correo = normalizarEmail(email)
  if (!correo) return invalido('Escribe un email válido.')
  const errorPassword = validarPasswordNueva(password)
  if (errorPassword) return invalido(errorPassword)
  const limite = await limitar('auth-signup', 5, 30 * 60)
  if (limite) return limite

  const next = destinoSeguro(redirectTo)
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password,
    options: {
      data: { full_name: nombreLimpio },
      emailRedirectTo: await urlDeConfirmacion(next),
    },
  })
  if (error) return desdeError(error)
  if (data.session) redirect(next)
  return {
    error: null,
    message:
      'Te enviamos un correo para confirmar tu cuenta. Puedes abrirlo desde cualquier dispositivo.',
  }
}

/**
 * Reenvía el correo de confirmación de registro. La respuesta es siempre la
 * misma para no revelar si el email existe.
 */
export async function resendConfirmation(
  email: string,
  redirectTo?: string
): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return noConfigurado()
  const correo = normalizarEmail(email)
  if (!correo) return invalido('Escribe un email válido.')
  const limite = await limitar('auth-resend', 3, 15 * 60)
  if (limite) return limite

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: correo,
    options: {
      emailRedirectTo: await urlDeConfirmacion(destinoSeguro(redirectTo)),
    },
  })
  if (esFalloDeEnvio(error))
    return { error: MENSAJE_ENVIO_FALLIDO, code: 'otro' }
  return { error: null, message: MENSAJE_EMAIL_REENVIADO }
}

/**
 * Enlace mágico (entrar sin contraseña) para cuentas ya registradas. La
 * respuesta es siempre la misma para no revelar si el email existe.
 */
export async function sendMagicLink(
  email: string,
  redirectTo?: string
): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return noConfigurado()
  const correo = normalizarEmail(email)
  if (!correo) return invalido('Escribe un email válido.')
  const limite = await limitar('auth-magic', 5, 15 * 60)
  if (limite) return limite

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: correo,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: await urlDeConfirmacion(destinoSeguro(redirectTo)),
    },
  })
  if (esFalloDeEnvio(error))
    return { error: MENSAJE_ENVIO_FALLIDO, code: 'otro' }
  return { error: null, message: MENSAJE_EMAIL_ENVIADO_MAGIC }
}

// ---------------------------------------------------------------------------
// Recuperación de contraseña
// ---------------------------------------------------------------------------

/**
 * Pide el correo de "¿Olvidaste tu contraseña?". La respuesta es siempre
 * genérica (no revela si el email tiene cuenta). El enlace lleva a
 * /auth/confirm (type=recovery) y de ahí a /auth/nueva-clave.
 */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return noConfigurado()
  const correo = normalizarEmail(email)
  if (!correo) return invalido('Escribe un email válido.')
  const limite = await limitar('auth-reset', 5, 15 * 60)
  if (limite) return limite

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(correo, {
    redirectTo: await urlDeConfirmacion(NUEVA_CLAVE_PATH),
  })
  if (esFalloDeEnvio(error))
    return { error: MENSAJE_ENVIO_FALLIDO, code: 'otro' }
  return { error: null, message: MENSAJE_EMAIL_ENVIADO_RESET }
}

/**
 * Fija la contraseña nueva. Requiere la sesión creada por el enlace de
 * recuperación (o de invitación) en este navegador.
 */
export async function updatePassword(
  password: string,
  confirmacion: string
): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return noConfigurado()
  const errorPassword = validarPasswordNueva(password)
  if (errorPassword) return invalido(errorPassword)
  if (password !== confirmacion)
    return invalido('Las contraseñas no coinciden.')

  const userId = await usuarioEnRecuperacion()
  if (!userId) return { error: MENSAJE_ENLACE, code: 'enlace' }

  const limite = await rateLimit({
    bucket: 'auth-update-password',
    id: userId,
    limit: 10,
    windowSec: 15 * 60,
  })
  if (!limite.ok) return { error: MENSAJE_LIMITE, code: 'limite' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return desdeError(error)

  // Por seguridad, cerramos las demás sesiones abiertas de la cuenta.
  try {
    await supabase.auth.signOut({ scope: 'others' })
  } catch {
    // No es crítico: la contraseña ya cambió.
  }
  await limpiarRecuperacion()
  return {
    error: null,
    message:
      'Listo, tu contraseña se actualizó. Ya puedes seguir planificando.',
  }
}

// ---------------------------------------------------------------------------
// Cierre de sesión
// ---------------------------------------------------------------------------

/**
 * Cierra la sesión y vuelve al inicio. Sirve como `<form action={signOut}>`.
 * En cliente, llama antes a clearOfflineData() para borrar los datos locales.
 */
export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      await supabase.auth.signOut()
    } catch {
      // Sin sesión o sin red: igualmente limpiamos y salimos.
    }
  }
  await limpiarRecuperacion()
  redirect('/')
}
