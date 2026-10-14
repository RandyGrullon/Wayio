import type { AuthErrorCode } from '@/lib/auth/types'

/**
 * Traducción de errores de Supabase Auth a mensajes amables en español, sin
 * detalles técnicos. Sin dependencias de servidor (la usa también el cliente).
 */

export const MENSAJE_NO_CONFIGURADO =
  'El inicio de sesión no está disponible en este momento. Inténtalo más tarde.'

export const MENSAJE_LIMITE =
  'Hiciste demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.'

export const MENSAJE_ENLACE =
  'El enlace no es válido o ya caducó. Si ya confirmaste tu cuenta, inicia sesión; si no, pide un enlace nuevo.'

export const MENSAJE_GENERICO =
  'Algo salió mal. Inténtalo de nuevo en unos minutos.'

interface ErrorLike {
  code?: string | undefined
  message?: string | undefined
  status?: number | undefined
}

export function traducirErrorAuth(error: ErrorLike | null | undefined): {
  mensaje: string
  code: AuthErrorCode
} {
  const code = error?.code ?? ''
  const msg = (error?.message ?? '').toLowerCase()

  if (
    code === 'invalid_credentials' ||
    msg.includes('invalid login credentials')
  ) {
    return {
      mensaje: 'El email o la contraseña no son correctos.',
      code: 'credenciales',
    }
  }
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return {
      mensaje:
        'Todavía no confirmaste tu email. Revisa tu bandeja de entrada (y la carpeta de spam).',
      code: 'email_no_confirmado',
    }
  }
  if (code === 'user_already_exists' || code === 'email_exists') {
    return {
      mensaje:
        'Ya existe una cuenta con ese email. Inicia sesión o recupera tu contraseña.',
      code: 'validacion',
    }
  }
  if (code === 'weak_password') {
    return {
      mensaje:
        'Esa contraseña es fácil de adivinar. Prueba con una más larga o que mezcle letras, números y símbolos.',
      code: 'validacion',
    }
  }
  if (code === 'same_password') {
    return {
      mensaje: 'La nueva contraseña debe ser distinta de la anterior.',
      code: 'validacion',
    }
  }
  if (
    code === 'email_address_invalid' ||
    code === 'validation_failed' ||
    code === 'email_address_not_authorized'
  ) {
    return {
      mensaje: 'Revisa que el email esté bien escrito.',
      code: 'validacion',
    }
  }
  if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    error?.status === 429
  ) {
    return { mensaje: MENSAJE_LIMITE, code: 'limite' }
  }
  if (
    code === 'signup_disabled' ||
    code === 'email_provider_disabled' ||
    code === 'provider_disabled'
  ) {
    return {
      mensaje: 'Esta forma de acceso no está disponible en este momento.',
      code: 'otro',
    }
  }
  if (
    code === 'otp_expired' ||
    code === 'flow_state_expired' ||
    code === 'flow_state_not_found' ||
    code === 'bad_code_verifier' ||
    code === 'session_not_found' ||
    code === 'session_expired' ||
    code === 'reauthentication_needed' ||
    code === 'reauthentication_not_valid'
  ) {
    return { mensaje: MENSAJE_ENLACE, code: 'enlace' }
  }
  return { mensaje: MENSAJE_GENERICO, code: 'otro' }
}

/** Mensaje para el parámetro ?error= con el que redirigen las rutas de auth. */
export function mensajeDeErrorUrl(error: string | null): string | null {
  switch (error) {
    case null:
    case '':
      return null
    case 'enlace':
      return MENSAJE_ENLACE
    case 'oauth':
      return 'No se pudo completar el inicio de sesión con Google. Si lo cancelaste, puedes intentarlo de nuevo.'
    case 'config':
      return MENSAJE_NO_CONFIGURADO
    case 'auth':
    default:
      return 'No pudimos completar el inicio de sesión. Inténtalo de nuevo.'
  }
}
