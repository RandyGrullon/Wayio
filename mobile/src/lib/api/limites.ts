/**
 * Mensajes de los límites de la IA (contrato con el backend web):
 * - 429 `{ code: 'rate_limit', retryAfter }` + Retry-After: límite PERSONAL
 *   de la cuenta (ventanas por hora y por día).
 * - 429 `{ code: 'tope_diario', retryAfter }`: Wayio agotó su presupuesto de IA
 *   del día (se reinicia a las 00:00 de RD). En generate, generate/stream,
 *   interpret y analyze-video; a mitad de la generación llega como evento SSE
 *   `{ type: 'error', code: 'tope_diario' }`.
 * - adjust y reschedule degradan con 503 `{ code: 'ia_no_disponible',
 *   motivo: 'tope_diario' }` (editar a mano), sin pasar por aquí.
 */
import { formatEspera } from '../utils/formatters'

export const CODIGO_TOPE_DIARIO = 'tope_diario'

/** Respaldo si el servidor no mandó texto (el del contrato). */
export const MENSAJE_TOPE_DIARIO =
  'Wayio llegó a su límite de IA por hoy. Vuelve a intentarlo mañana.'

/** ¿El error es el tope diario GLOBAL de IA (no el límite de la cuenta)? */
export function esTopeDiario(
  code: string | null | undefined,
  data?: Record<string, unknown> | null
): boolean {
  return (
    code === CODIGO_TOPE_DIARIO ||
    data?.['code'] === CODIGO_TOPE_DIARIO ||
    data?.['motivo'] === CODIGO_TOPE_DIARIO
  )
}

/** «Vuelve a intentarlo en 40 min.» / «… en 3 horas.»; null sin espera. */
export function textoReintento(
  segundos: number | null | undefined
): string | null {
  const espera = formatEspera(segundos)
  return espera ? `Vuelve a intentarlo en ${espera}.` : null
}

export interface ErrorDeLimite {
  status: number | null
  /** `code` técnico del servidor. */
  code: string | null
  data?: Record<string, unknown> | null
  retryAfter: number | null
  /** Texto ya listo para mostrar (normalmente el del servidor). */
  mensaje: string
}

/**
 * Texto para un error de límite de la IA, o null si no lo es:
 * - tope diario global → el texto del servidor (o el del contrato);
 * - límite personal (429) con espera → `base` + «Vuelve a intentarlo en N
 *   min.». Se arma aquí en vez de añadirlo al texto del servidor, que ya
 *   puede traer su propia espera y quedaría repetido.
 */
export function mensajeDeLimite(e: ErrorDeLimite, base: string): string | null {
  if (esTopeDiario(e.code, e.data)) {
    return e.mensaje.trim() || MENSAJE_TOPE_DIARIO
  }
  if (e.status !== 429) return null
  const reintento = textoReintento(e.retryAfter)
  return reintento ? `${base} ${reintento}` : null
}
