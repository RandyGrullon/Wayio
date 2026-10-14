/**
 * Formatos es-DO de la interfaz (docs/DISENO.md §1.4).
 *
 * - Importes estimados sin decimales («US$1,840», «RD$108,500»); pagos con 2.
 * - Fechas «sáb, 12 nov» y rangos «12–18 nov 2026». Nunca ISO crudo.
 * - Horas en 12 h: «9:30 a. m.».
 *
 * Fechas y horas se componen a mano (no con Intl) para que el texto sea
 * idéntico en el servidor y en cualquier navegador (sin desajustes de
 * hidratación por versiones de ICU). Las cadenas 'YYYY-MM-DD' se interpretan
 * en hora LOCAL, no en UTC (evita que «12 nov» salga como «11 nov»).
 */

const LOCALE = 'es-DO'
/** Espacio duro: «9:30 a. m.» y «91 %» no se parten entre líneas. */
const NBSP = ' '

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const
const MESES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sept',
  'oct',
  'nov',
  'dic',
] as const

export type FechaEntrada = string | number | Date

// ─── Fechas: utilidades base ───────────────────────────────────────────────

/** Convierte a Date; 'YYYY-MM-DD' se toma como fecha local. null si no vale. */
export function parseFecha(
  valor: FechaEntrada | null | undefined
): Date | null {
  if (valor === null || valor === undefined || valor === '') return null
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor
  }
  if (typeof valor === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim())
    if (m) {
      const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      return Number.isNaN(fecha.getTime()) ? null : fecha
    }
  }
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

/** Hoy en hora local como 'YYYY-MM-DD' (para el `min` de los inputs date). */
export function hoyLocal(): string {
  return new Date().toLocaleDateString('en-CA')
}

/** 'YYYY-MM-DD' local de una fecha. */
export function toISODateLocal(fecha: Date): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function inicioDelDia(fecha: Date): number {
  return new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate()
  ).getTime()
}

const DIA_MS = 24 * 60 * 60 * 1000

/** Noches entre dos fechas (0 si faltan o el fin es anterior). */
export function contarNoches(
  inicio: FechaEntrada | null | undefined,
  fin: FechaEntrada | null | undefined
): number {
  const a = parseFecha(inicio)
  const b = parseFecha(fin)
  if (!a || !b) return 0
  return Math.max(0, Math.round((inicioDelDia(b) - inicioDelDia(a)) / DIA_MS))
}

/** Días de viaje (noches + 1). 0 si faltan fechas. */
export function contarDias(
  inicio: FechaEntrada | null | undefined,
  fin: FechaEntrada | null | undefined
): number {
  const a = parseFecha(inicio)
  const b = parseFecha(fin)
  if (!a || !b || inicioDelDia(b) < inicioDelDia(a)) return 0
  return contarNoches(a, b) + 1
}

/** Días que faltan hasta una fecha (negativo si ya pasó). */
export function diasHasta(
  fecha: FechaEntrada,
  desde: Date = new Date()
): number {
  const f = parseFecha(fecha)
  if (!f) return 0
  return Math.round((inicioDelDia(f) - inicioDelDia(desde)) / DIA_MS)
}

// ─── Fechas: texto ─────────────────────────────────────────────────────────

/**
 * «sáb, 12 nov» (por defecto) · «sáb, 12 nov 2026» (anio) · «12 nov»
 * (sin diaSemana). Devuelve '' si la fecha no es válida.
 */
export function formatFecha(
  valor: FechaEntrada | null | undefined,
  opciones: { anio?: boolean; diaSemana?: boolean } = {}
): string {
  const f = parseFecha(valor)
  if (!f) return ''
  const { anio = false, diaSemana = true } = opciones
  const base = `${f.getDate()} ${MESES[f.getMonth()]}`
  const conAnio = anio ? `${base} ${f.getFullYear()}` : base
  return diaSemana ? `${DIAS[f.getDay()]}, ${conAnio}` : conAnio
}

/** Día corto para los chips de día: «sáb 12». */
export function formatDiaCorto(valor: FechaEntrada | null | undefined): string {
  const f = parseFecha(valor)
  if (!f) return ''
  return `${DIAS[f.getDay()]} ${f.getDate()}`
}

/**
 * Rango de fechas: «12–18 nov 2026», «28 nov – 3 dic 2026» o
 * «28 dic 2026 – 3 ene 2027». Si solo hay una fecha, la muestra sola.
 */
export function formatRangoFechas(
  inicio: FechaEntrada | null | undefined,
  fin: FechaEntrada | null | undefined
): string {
  const a = parseFecha(inicio)
  const b = parseFecha(fin)
  if (!a && !b) return ''
  if (!a || !b) return formatFecha(a ?? b, { anio: true, diaSemana: false })
  const mismoAnio = a.getFullYear() === b.getFullYear()
  const mismoMes = mismoAnio && a.getMonth() === b.getMonth()
  if (mismoMes && a.getDate() === b.getDate()) {
    return formatFecha(a, { anio: true, diaSemana: false })
  }
  if (mismoMes) {
    return `${a.getDate()}–${b.getDate()} ${MESES[b.getMonth()]} ${b.getFullYear()}`
  }
  if (mismoAnio) {
    return `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]} ${b.getFullYear()}`
  }
  return `${formatFecha(a, { anio: true, diaSemana: false })} – ${formatFecha(b, { anio: true, diaSemana: false })}`
}

/** «6 noches · sáb, 12 nov → vie, 18 nov» (resumen bajo los dates). */
export function formatResumenFechas(
  inicio: FechaEntrada | null | undefined,
  fin: FechaEntrada | null | undefined
): string {
  const a = parseFecha(inicio)
  const b = parseFecha(fin)
  if (!a) return ''
  if (!b) return formatFecha(a)
  return `${formatNoches(contarNoches(a, b))} · ${formatFecha(a)} → ${formatFecha(b)}`
}

/** «8 oct, 2:32 p. m.» (guardado, sincronizado…). */
export function formatFechaHora(
  valor: FechaEntrada | null | undefined
): string {
  const f = parseFecha(valor)
  if (!f) return ''
  return `${formatFecha(f, { diaSemana: false })}, ${formatHora12(f)}`
}

/** «hace 2 días», «ayer», «hace 5 min» (Intl.RelativeTimeFormat). */
export function formatHaceTiempo(
  valor: FechaEntrada | null | undefined,
  ahora: Date = new Date()
): string {
  const f = parseFecha(valor)
  if (!f) return ''
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
  const seg = Math.round((f.getTime() - ahora.getTime()) / 1000)
  const abs = Math.abs(seg)
  if (abs < 60) return 'ahora mismo'
  if (abs < 3600) return rtf.format(Math.round(seg / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seg / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(seg / 86400), 'day')
  if (abs < 86400 * 365)
    return rtf.format(Math.round(seg / (86400 * 30)), 'month')
  return rtf.format(Math.round(seg / (86400 * 365)), 'year')
}

// ─── Horas ─────────────────────────────────────────────────────────────────

/** Separa una hora en 12 h: { hora: '9:30', periodo: 'a. m.' }. */
export function formatHora12Partes(
  valor: string | Date | null | undefined
): { hora: string; periodo: string } | null {
  if (valor === null || valor === undefined || valor === '') return null
  let h: number
  let min: number
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null
    h = valor.getHours()
    min = valor.getMinutes()
  } else {
    const m = /^(\d{1,2}):(\d{2})/.exec(valor.trim())
    if (!m) return null
    h = Number(m[1])
    min = Number(m[2])
    if (h > 23 || min > 59) return null
  }
  const h12 = h % 12 === 0 ? 12 : h % 12
  return {
    hora: `${h12}:${String(min).padStart(2, '0')}`,
    periodo: h < 12 ? `a.${NBSP}m.` : `p.${NBSP}m.`,
  }
}

/** «9:30 a. m.» a partir de 'HH:mm' o de un Date. '' si no es válida. */
export function formatHora12(valor: string | Date | null | undefined): string {
  const partes = formatHora12Partes(valor)
  return partes ? `${partes.hora}${NBSP}${partes.periodo}` : ''
}

/** Duración en minutos: «45 min», «1 h 30», «2 h». */
export function formatDuracion(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined || !Number.isFinite(minutos)) {
    return ''
  }
  const total = Math.max(0, Math.round(minutos))
  if (total < 60) return `${total}${NBSP}min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h}${NBSP}h` : `${h}${NBSP}h ${String(m).padStart(2, '0')}`
}

// ─── Plurales ──────────────────────────────────────────────────────────────

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

export function formatNoches(n: number): string {
  return plural(n, 'noche', 'noches')
}
export function formatDias(n: number): string {
  return plural(n, 'día', 'días')
}
export function formatViajeros(n: number): string {
  return plural(n, 'viajero', 'viajeros')
}
/** «Faltan 23 días» · «Falta 1 día» · «Es hoy». */
export function formatFaltan(dias: number): string {
  if (dias <= 0) return 'Es hoy'
  return dias === 1 ? 'Falta 1 día' : `Faltan ${dias} días`
}

// ─── Números y dinero ──────────────────────────────────────────────────────

export interface OpcionesMoneda {
  /** 2 decimales (pagos, depósitos). Por defecto 0 (estimados). */
  decimales?: boolean
  /** Muestra siempre el signo («+US$45»). */
  signo?: boolean
}

/** Monedas cuyo símbolo estrecho no es ambiguo («€» en vez de «EUR»). */
const SIMBOLO_ESTRECHO = new Set(['EUR', 'GBP', 'JPY', 'KRW', 'INR', 'CHF'])

/**
 * Importe en es-DO: «US$1,840» · «RD$108,500» · «€1,840». Mantiene la firma
 * antigua (importe, moneda = 'USD'); el tercer parámetro es opcional.
 */
export function formatCurrency(
  amount: number,
  currency = 'USD',
  opciones: OpcionesMoneda = {}
): string {
  if (!Number.isFinite(amount)) return '—'
  const codigo = (currency || 'USD').toUpperCase()
  const fraccion = opciones.decimales ? 2 : 0
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: codigo,
      currencyDisplay: SIMBOLO_ESTRECHO.has(codigo) ? 'narrowSymbol' : 'symbol',
      minimumFractionDigits: fraccion,
      maximumFractionDigits: fraccion,
      signDisplay: opciones.signo ? 'exceptZero' : 'auto',
    }).format(amount)
  } catch {
    // Código de moneda no reconocido por Intl.
    return `${codigo} ${formatNumero(amount, fraccion)}`
  }
}

/** Alias en español de formatCurrency. */
export const formatMoneda = formatCurrency

/** Número en es-DO («1,284», «12.4»). */
export function formatNumero(n: number, decimales = 0): string {
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n)
}

/** Porcentaje «91 %» (n en 0–100). */
export function formatPorcentaje(n: number, decimales = 0): string {
  if (!Number.isFinite(n)) return '—'
  return `${formatNumero(n, decimales)}${NBSP}%`
}

// ─── Mapa ──────────────────────────────────────────────────────────────────

/** «18.4861° N · 69.9312° O» (Geist Mono). */
export function formatCoordenadas(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ''
  const ns = lat >= 0 ? 'N' : 'S'
  const eo = lng >= 0 ? 'E' : 'O'
  return `${Math.abs(lat).toFixed(4)}° ${ns} · ${Math.abs(lng).toFixed(4)}° ${eo}`
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${formatNumero(meters / 1000, 1)}${NBSP}km`
  }
  return `${Math.round(meters)}${NBSP}m`
}
