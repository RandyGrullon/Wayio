/**
 * Límites de la IA vistos desde el cliente web (contrato de las rutas de IA):
 * - 429 `code: 'rate_limit'`: límite personal (por hora o por día) con
 *   `retryAfter` en segundos y la cabecera Retry-After.
 * - 429 `code: 'tope_diario'`: Wayio llegó a su tope de gasto de IA del día
 *   (día natural de RD). Lo mismo llega como evento SSE de error si se corta
 *   a mitad de una generación.
 * - 503 `code: 'ia_no_disponible', motivo: 'tope_diario'` en /api/adjust y
 *   /api/reschedule, que ofrecen la edición a mano.
 */

export const CODIGO_TOPE_DIARIO = 'tope_diario'

/** Por si el servidor no manda texto (el suyo tiene prioridad). */
export const MENSAJE_TOPE_DIARIO =
  'Wayio llegó a su límite de IA por hoy. Vuelve a intentarlo mañana.'

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** `code` del cuerpo JSON (o null). */
export function codigoDe(data: unknown): string | null {
  if (!esObjeto(data)) return null
  const c = data['code']
  return typeof c === 'string' && c.trim() ? c : null
}

/** ¿El cuerpo (o el code) dice que se alcanzó el tope diario de Wayio? */
export function esTopeDiario(data: unknown): boolean {
  if (typeof data === 'string') return data === CODIGO_TOPE_DIARIO
  if (!esObjeto(data)) return false
  return (
    data['code'] === CODIGO_TOPE_DIARIO || data['motivo'] === CODIGO_TOPE_DIARIO
  )
}

/** Segundos de espera de un 429: `retryAfter` del cuerpo o Retry-After. */
export function segundosDeEspera(
  data: unknown,
  res?: Pick<Response, 'headers'>
): number | null {
  const crudo = esObjeto(data) ? data['retryAfter'] : undefined
  const n = Number(crudo ?? res?.headers.get('Retry-After') ?? NaN)
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : null
}

/**
 * Cuándo se podrá volver a intentar, listo para «Podrás volver a intentarlo
 * …»: «en un minuto», «en 25 minutos», «en una hora», «en 5 horas» o
 * «mañana» (si la espera es larga y termina otro día). Redondea hacia arriba
 * para no invitar a reintentar antes de tiempo.
 */
export function textoEspera(segundos: number, ahora = new Date()): string {
  const minutos = Math.max(1, Math.ceil(segundos / 60))
  if (minutos <= 1) return 'en un minuto'
  if (minutos < 60) return `en ${minutos} minutos`
  const horas = Math.ceil(minutos / 60)
  const fin = new Date(ahora.getTime() + segundos * 1000)
  const manana = new Date(ahora)
  manana.setDate(manana.getDate() + 1)
  if (horas >= 6 && fin.toDateString() === manana.toDateString()) {
    return 'mañana'
  }
  return horas === 1 ? 'en una hora' : `en ${horas} horas`
}
