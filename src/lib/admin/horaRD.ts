/**
 * Hora de República Dominicana para el panel (servidor y cliente).
 *
 * - Las series «por día» agrupan por el día natural de Santo Domingo, no por
 *   el de UTC: un registro a las 9:00 p. m. del lunes (hora de RD) cuenta el
 *   lunes, aunque en UTC ya sea martes.
 * - Los campos de fecha y hora del panel (anuncios programados) se escriben
 *   en hora de RD sea cual sea la zona del navegador.
 */

export const ZONA_RD = 'America/Santo_Domingo'

const DIA_MS = 86_400_000

let formatoDia: Intl.DateTimeFormat | null = null
let formatoHora: Intl.DateTimeFormat | null = null

function aFecha(instante: string | number | Date): Date | null {
  const d = instante instanceof Date ? instante : new Date(instante)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Día de RD ('YYYY-MM-DD') en que cae un instante; '' si no es válido. */
export function diaRD(instante: string | number | Date): string {
  const d = aFecha(instante)
  if (!d) return ''
  // en-CA formatea la fecha como YYYY-MM-DD.
  formatoDia ??= new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_RD,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatoDia.format(d)
}

/**
 * Los últimos `dias` días naturales de RD, del más antiguo a hoy. Se cuenta
 * en días de calendario (no restando 24 h), así que nunca se salta ni repite
 * un día.
 */
export function ultimosDiasRD(
  dias: number,
  ahora: number = Date.now()
): string[] {
  const [a, m, d] = diaRD(ahora).split('-').map(Number)
  const hoy = Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1)
  return Array.from({ length: Math.max(0, dias) }, (_, i) =>
    new Date(hoy - (dias - 1 - i) * DIA_MS).toISOString().slice(0, 10)
  )
}

/** Hora de pared de RD de un instante, leída como si fuera UTC (en ms). */
function paredRD(instante: number): number {
  formatoHora ??= new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_RD,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const partes = formatoHora.formatToParts(new Date(instante))
  const n = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((p) => p.type === tipo)?.value ?? 0)
  return Date.UTC(
    n('year'),
    n('month') - 1,
    n('day'),
    n('hour'),
    n('minute'),
    n('second')
  )
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/**
 * Valor de un `<input type="datetime-local">` («2026-11-12T09:30»)
 * interpretado como hora de RD → instante ISO en UTC. null si no es válido.
 */
export function horaRDaIso(local: string): string | null {
  const m = LOCAL_RE.exec(local.trim())
  if (!m) return null
  const [, a, mes, d, h, min, s] = m
  const comoUtc = Date.UTC(
    Number(a),
    Number(mes) - 1,
    Number(d),
    Number(h),
    Number(min),
    Number(s ?? 0)
  )
  if (Number.isNaN(comoUtc)) return null
  // Dos pasadas: la segunda corrige si el desfase cambia en ese instante.
  let instante = comoUtc - (paredRD(comoUtc) - comoUtc)
  instante = comoUtc - (paredRD(instante) - instante)
  // Date.UTC desborda en silencio (30 de febrero → 2 de marzo): si la hora
  // de pared no coincide con la escrita, la fecha no existía.
  if (isoAHoraRD(instante) !== `${a}-${mes}-${d}T${h}:${min}`) return null
  return new Date(instante).toISOString()
}

/** Instante → valor de `<input type="datetime-local">` en hora de RD. */
export function isoAHoraRD(instante: string | number | Date): string {
  const d = aFecha(instante)
  if (!d) return ''
  return new Date(paredRD(d.getTime())).toISOString().slice(0, 16)
}
