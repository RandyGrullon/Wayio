import {
  CUPO_GRATIS,
  NOMBRE_ACCION,
  type AccionConCupo,
} from '@/constants/planes'
import { formatFecha } from '@/lib/utils/formatters'

/**
 * Límites de la IA vistos desde el cliente web (contrato de las rutas de IA):
 * - 429 `code: 'rate_limit'`: límite personal (por hora o por día) con
 *   `retryAfter` en segundos y la cabecera Retry-After.
 * - 429 `code: 'tope_diario'`: Wayio llegó a su tope de gasto de IA del día
 *   (día natural de RD). Lo mismo llega como evento SSE de error si se corta
 *   a mitad de una generación.
 * - 503 `code: 'ia_no_disponible', motivo: 'tope_diario'` en /api/adjust y
 *   /api/reschedule, que ofrecen la edición a mano.
 * - 402 `code: 'cupo_agotado'` en /api/generate, /api/generate/stream (antes
 *   de abrir el stream), /api/adjust y /api/analyze-video: el plan Gratis
 *   gastó su cupo del mes. Trae `accion`, `usados`, `limite` y `renueva`
 *   ('YYYY-MM-DD'). Reintentar no sirve: se ofrece «Ver planes».
 * - 503 `code: 'ia_no_disponible', motivo: 'requiere_pro'` en
 *   /api/reschedule: reagendar con IA es de Pro; llegan los huecos libres.
 */

export const CODIGO_TOPE_DIARIO = 'tope_diario'

export const CODIGO_CUPO_AGOTADO = 'cupo_agotado'

export const MOTIVO_REQUIERE_PRO = 'requiere_pro'

/** Página de planes (la URL indexada; /planes redirige aquí). */
export const RUTA_PLANES = '/precios'

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

// ─── Cupo mensual del plan Gratis (402 cupo_agotado) ──────────────────────

/** Datos de un 402 cupo_agotado (todo opcional: el texto del servidor manda). */
export interface CupoAgotado {
  accion: AccionConCupo | null
  usados: number | null
  limite: number | null
  /** 'YYYY-MM-DD' en que se renueva el cupo. */
  renueva: string | null
  /** Mensaje del servidor, ya en español. */
  mensaje: string | null
}

function esAccionConCupo(v: unknown): v is AccionConCupo {
  return v === 'generar' || v === 'ajustar' || v === 'analizar'
}

const entero = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null

const textoNoVacio = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null

/** ¿El cuerpo (o el code) dice que se agotó el cupo del mes? */
export function esCupoAgotado(data: unknown): boolean {
  if (typeof data === 'string') return data === CODIGO_CUPO_AGOTADO
  return esObjeto(data) && data['code'] === CODIGO_CUPO_AGOTADO
}

/** Lee un 402 cupo_agotado; null si el cuerpo no es de cupo agotado. */
export function leerCupoAgotado(data: unknown): CupoAgotado | null {
  if (!esObjeto(data) || !esCupoAgotado(data)) return null
  const accion = data['accion']
  return {
    accion: esAccionConCupo(accion) ? accion : null,
    usados: entero(data['usados']),
    limite: entero(data['limite']),
    renueva: textoNoVacio(data['renueva']),
    mensaje: textoNoVacio(data['error']) ?? textoNoVacio(data['mensaje']),
  }
}

/** «el 1 nov» a partir de 'YYYY-MM-DD' (vacío si la fecha no vale). */
export function textoRenovacion(renueva: string | null | undefined): string {
  const fecha = formatFecha(renueva, { diaSemana: false })
  return fecha ? `el ${fecha}` : ''
}

/** Acciones con cupo, en el orden en que se muestran. */
export const ACCIONES_CON_CUPO: readonly AccionConCupo[] = [
  'generar',
  'ajustar',
  'analizar',
]

/** «2 viajes», «1 ajuste con IA», «3 fotos o videos». */
export function cantidadAccion(accion: AccionConCupo, n: number): string {
  const nombre = NOMBRE_ACCION[accion]
  return `${n} ${n === 1 ? nombre.uno : nombre.varios}`
}

/** «a», «a y b», «a, b y c». */
export function listaConY(partes: readonly string[]): string {
  if (partes.length <= 1) return partes[0] ?? ''
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

/** Cupo mensual de Gratis: «2 viajes, 5 ajustes con IA y 3 fotos o videos». */
export const TEXTO_CUPO_GRATIS = listaConY(
  ACCIONES_CON_CUPO.map((a) => cantidadAccion(a, CUPO_GRATIS[a]))
)

/**
 * Texto de respaldo de un cupo agotado (el del servidor tiene prioridad):
 * «Ya usaste tus 2 viajes gratis de este mes. Tu cupo se renueva el 1 nov.
 * Con Pro la IA no tiene límite.»
 */
export function mensajeCupoAgotado(
  accion: AccionConCupo | null,
  renueva?: string | null
): string {
  const cuando = textoRenovacion(renueva) || 'el día 1 de cada mes'
  const cierre = `Tu cupo se renueva ${cuando}. Con Pro la IA no tiene límite.`
  if (!accion) return `Ya usaste tu cupo gratis de IA de este mes. ${cierre}`
  const limite = CUPO_GRATIS[accion]
  return `Ya usaste ${limite === 1 ? 'tu' : 'tus'} ${cantidadAccion(accion, limite)} gratis de este mes. ${cierre}`
}

/** Mensaje para mostrar de un 402: el del servidor o el de respaldo. */
export function textoCupoAgotado(
  data: unknown,
  accionPorDefecto: AccionConCupo
): string {
  const cupo = leerCupoAgotado(data)
  return (
    cupo?.mensaje ??
    mensajeCupoAgotado(cupo?.accion ?? accionPorDefecto, cupo?.renueva)
  )
}

/** ¿/api/reschedule dice que reagendar con IA es de Pro? */
export function esRequierePro(data: unknown): boolean {
  if (typeof data === 'string') return data === MOTIVO_REQUIERE_PRO
  return esObjeto(data) && data['motivo'] === MOTIVO_REQUIERE_PRO
}
