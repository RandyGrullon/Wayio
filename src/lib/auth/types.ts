/** Categoría del error de auth, para que la UI decida qué ofrecer. */
export type AuthErrorCode =
  /** Datos del formulario inválidos (email mal escrito, contraseña corta...). */
  | 'validacion'
  /** Email o contraseña incorrectos. */
  | 'credenciales'
  /** La cuenta existe pero no confirmó el email: ofrecer "Reenviar correo". */
  | 'email_no_confirmado'
  /** Demasiados intentos: esperar. */
  | 'limite'
  /** Enlace caducado/usado o sesión de recuperación inexistente: pedir otro. */
  | 'enlace'
  /** Supabase no está configurado en este despliegue (modo demo). */
  | 'no_configurado'
  | 'otro'

/**
 * Resultado de las server actions de auth. Si la acción redirige (login
 * correcto, Google), la promesa no llega a devolver nada útil.
 */
export interface AuthResult {
  /** Mensaje de error apto para mostrar al usuario, o null si salió bien. */
  error: string | null
  /** Mensaje informativo para mostrar cuando salió bien (p. ej. "Revisa tu email"). */
  message?: string
  code?: AuthErrorCode
}
