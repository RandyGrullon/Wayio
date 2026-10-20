/**
 * Mensajes de los límites de la IA (contrato con el backend web):
 * - 429 `{ code: 'rate_limit', retryAfter }` + Retry-After: límite PERSONAL
 *   de la cuenta (ventanas por hora y por día).
 * - 429 `{ code: 'tope_diario', retryAfter }`: Wayio agotó su presupuesto de IA
 *   del día (se reinicia a las 00:00 de RD). En generate, generate/stream,
 *   interpret y analyze-video; a mitad de la generación llega como evento SSE
 *   `{ type: 'error', code: 'tope_diario' }`.
 * - 402 `{ error, code: 'cupo_agotado', accion, usados, limite, renueva }`:
 *   el plan Gratis agotó el cupo del mes de esa acción (generate,
 *   generate/stream antes de abrir el stream, adjust y analyze-video). No se
 *   reintenta: se muestra el texto del servidor con «Ver planes».
 * - adjust y reschedule degradan con 503 `{ code: 'ia_no_disponible',
 *   motivo: 'tope_diario' }` (editar a mano), sin pasar por aquí.
 * - reschedule para Gratis: 503 `{ code: 'ia_no_disponible', motivo:
 *   'requiere_pro', huecos }`: se elige el hueco a mano (`esRequierePro`).
 */
import { formatEspera, formatFecha } from '../utils/formatters'
import {
  CUPO_GRATIS,
  NOMBRE_ACCION,
  type AccionConCupo,
} from '../../constants/pricing'
import { BackendError, MENSAJE_CUPO_AGOTADO } from './http'
import { ErrorGeneracion } from './stream'

export const CODIGO_TOPE_DIARIO = 'tope_diario'
export const CODIGO_CUPO_AGOTADO = 'cupo_agotado'
/** `motivo` del 503 de reschedule cuando la IA es solo de Pro. */
export const MOTIVO_REQUIERE_PRO = 'requiere_pro'

/** Respaldo si el servidor no mandó texto (el del contrato). */
export const MENSAJE_TOPE_DIARIO =
  'Wayio llegó a su límite de IA por hoy. Vuelve a intentarlo mañana.'

/** Línea de reagendar a mano en Gratis. */
export const TEXTO_REAGENDAR_PRO = 'Con Pro, la IA te propone la mejor hora.'

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

/** ¿El 503 de reschedule es porque proponer con IA es solo de Pro? */
export function esRequierePro(
  data: Record<string, unknown> | null | undefined
): boolean {
  return data?.['motivo'] === MOTIVO_REQUIERE_PRO
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
 * Datos de límite de un error del backend (`BackendError` de http.ts o
 * `ErrorGeneracion` del stream); null si es otro tipo de error.
 */
export function datosDeLimite(e: unknown): ErrorDeLimite | null {
  if (e instanceof BackendError) {
    return {
      status: e.status,
      code: e.serverCode,
      data: e.data,
      retryAfter: e.retryAfter,
      mensaje: e.message,
    }
  }
  if (e instanceof ErrorGeneracion) {
    return {
      status: e.status,
      code: e.code,
      data: e.data,
      retryAfter: e.retryAfter,
      mensaje: e.message,
    }
  }
  return null
}

/**
 * Texto para un error de límite de la IA, o null si no lo es:
 * - tope diario global → el texto del servidor (o el del contrato);
 * - límite personal (429) con espera → `base` + «Vuelve a intentarlo en N
 *   min.». Se arma aquí en vez de añadirlo al texto del servidor, que ya
 *   puede traer su propia espera y quedaría repetido.
 * El cupo del mes agotado (402) va aparte: ver `cupoAgotadoDe`.
 */
export function mensajeDeLimite(e: ErrorDeLimite, base: string): string | null {
  if (esTopeDiario(e.code, e.data)) {
    return e.mensaje.trim() || MENSAJE_TOPE_DIARIO
  }
  if (e.status !== 429) return null
  const reintento = textoReintento(e.retryAfter)
  return reintento ? `${base} ${reintento}` : null
}

// ── Cupo del mes (plan Gratis) ─────────────────────────────────────────────

export interface CupoAgotado {
  /** Texto para mostrar: el del servidor o uno armado con los datos. */
  mensaje: string
  accion: AccionConCupo | null
  usados: number | null
  limite: number | null
  /** 'YYYY-MM-DD' en que se renueva el cupo. */
  renueva: string | null
}

function esAccion(v: unknown): v is AccionConCupo {
  return v === 'generar' || v === 'ajustar' || v === 'analizar'
}

function entero(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
    ? Math.round(v)
    : null
}

/** ¿Es el 402 de cupo agotado del plan Gratis? */
export function esCupoAgotado(e: ErrorDeLimite): boolean {
  return (
    e.status === 402 ||
    e.code === CODIGO_CUPO_AGOTADO ||
    e.data?.['code'] === CODIGO_CUPO_AGOTADO
  )
}

/**
 * Texto de respaldo si el 402 llegó sin mensaje: «Ya usaste tus 2 viajes de
 * este mes. Se renuevan el 1 nov.».
 */
function mensajeArmado(
  accion: AccionConCupo | null,
  limite: number | null,
  renueva: string | null
): string {
  if (!accion) return MENSAJE_CUPO_AGOTADO
  const n = limite ?? CUPO_GRATIS[accion]
  const nombre =
    n === 1 ? NOMBRE_ACCION[accion].uno : NOMBRE_ACCION[accion].varios
  const fecha = renueva ? formatFecha(renueva, { diaSemana: false }) : ''
  const cuando = fecha
    ? ` Se renuevan el ${fecha}.`
    : ' Se renuevan el día 1 del mes.'
  return `Ya usaste ${n === 1 ? 'tu' : 'tus'} ${n} ${nombre} de este mes.${cuando} Con Pro no tienes ese límite.`
}

/**
 * Datos del 402 `cupo_agotado`, o null si el error es otro. El mensaje es el
 * del servidor (`error`); solo si no vino se arma uno con los datos.
 */
export function cupoAgotadoDe(e: ErrorDeLimite | null): CupoAgotado | null {
  if (!e || !esCupoAgotado(e)) return null
  const d = e.data ?? null
  const accionRaw = d?.['accion']
  const accion = esAccion(accionRaw) ? accionRaw : null
  const limite = entero(d?.['limite'])
  const renuevaRaw = d?.['renueva']
  const renueva =
    typeof renuevaRaw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(renuevaRaw)
      ? renuevaRaw.slice(0, 10)
      : null
  const servidor = e.mensaje.trim()
  return {
    mensaje:
      servidor && servidor !== MENSAJE_CUPO_AGOTADO
        ? servidor
        : mensajeArmado(accion, limite, renueva),
    accion,
    usados: entero(d?.['usados']),
    limite,
    renueva,
  }
}
