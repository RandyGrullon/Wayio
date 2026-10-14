/**
 * Constantes compartidas del flujo de autenticación (web). Sin dependencias de
 * servidor: se pueden importar desde componentes cliente.
 */

/** Página donde el usuario elige su nueva contraseña tras un enlace de recuperación. */
export const NUEVA_CLAVE_PATH = '/auth/nueva-clave'

/** Página para pedir el enlace de recuperación de contraseña. */
export const RECUPERAR_PATH = '/auth/recuperar'

/** Deep link de la app móvil que recibe los enlaces de auth (verifyOtp en la app). */
export const APP_AUTH_CALLBACK = 'wayio://auth/callback'

/**
 * Cookie httpOnly que marca que la sesión actual viene de un enlace de
 * recuperación o invitación recién verificado. Su valor es el id del usuario,
 * así que no sirve para otra cuenta. Solo la pone el servidor.
 */
export const RECOVERY_COOKIE = 'wayio-recovery'

/** Vida de la marca de recuperación (30 min). */
export const RECOVERY_COOKIE_MAX_AGE = 30 * 60

/** Política de contraseñas para cuentas nuevas y cambios de contraseña. */
export const PASSWORD_MIN = 8
/** bcrypt solo usa los primeros 72 bytes; más largo no añade seguridad. */
export const PASSWORD_MAX = 72

/** Tipos de enlace de email que aceptamos en /auth/confirm. */
export const TIPOS_OTP_EMAIL = [
  'email',
  'signup',
  'magiclink',
  'recovery',
  'invite',
  'email_change',
] as const

export type TipoOtpEmail = (typeof TIPOS_OTP_EMAIL)[number]

export function tipoOtpValido(v: string | null): TipoOtpEmail | null {
  if (!v) return null
  return (TIPOS_OTP_EMAIL as readonly string[]).includes(v)
    ? (v as TipoOtpEmail)
    : null
}
