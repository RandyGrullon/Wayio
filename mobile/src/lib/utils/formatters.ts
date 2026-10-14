/**
 * Formatos es-DO de la app (docs/DISENO.md §1.4), equivalentes a
 * src/lib/utils/formatters.ts de la web. Fuente única: components/ui/formato.ts
 * y lib/utils/format.ts solo reexportan este módulo.
 *
 * - Importes estimados sin decimales («US$1,840», «RD$108,500»); pagos con 2.
 * - Fechas «sáb, 12 nov» y rangos «12–18 nov 2026». Nunca ISO crudo.
 * - Horas en 12 h: «9:30 a. m.».
 *
 * Todo se compone a mano (sin Intl): Hermes no trae todos los locales ni
 * `RelativeTimeFormat`, y así el texto es idéntico en iOS y Android. Las
 * cadenas 'YYYY-MM-DD' se interpretan en hora LOCAL.
 */
import type { Moneda } from '../../types/planning'

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
const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

export type FechaEntrada = string | number | Date

// ─── Fechas: base ──────────────────────────────────────────────────────────

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

/** 'YYYY-MM-DD' local de una fecha. */
export function toISODateLocal(fecha: Date): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Hoy en hora local como 'YYYY-MM-DD'. */
export function hoyLocal(): string {
  return toISODateLocal(new Date())
}

function inicioDelDia(fecha: Date): number {
  return new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate()
  ).getTime()
}

const DIA_MS = 24 * 60 * 60 * 1000

/** Suma días a una fecha local y devuelve 'YYYY-MM-DD' ('' si no vale). */
export function sumarDias(valor: FechaEntrada, dias: number): string {
  const f = parseFecha(valor)
  if (!f) return ''
  return toISODateLocal(
    new Date(f.getFullYear(), f.getMonth(), f.getDate() + dias)
  )
}

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

/** Días de viaje (noches + 1). 0 si faltan fechas o el fin es anterior. */
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

/** «sáb, 12 nov» · «sáb, 12 nov 2026» (anio) · «12 nov» (sin diaSemana). */
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

/** «noviembre 2026» (cabecera del calendario). */
export function formatMesAnio(valor: FechaEntrada | null | undefined): string {
  const f = parseFecha(valor)
  if (!f) return ''
  return `${MESES_LARGOS[f.getMonth()]} ${f.getFullYear()}`
}

/** Iniciales de los días de la semana, empezando en lunes. */
export const DIAS_SEMANA_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const
export const DIAS_SEMANA_LARGOS = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const

/** «sábado, 12 de noviembre de 2026» (para lectores de pantalla). */
export function formatFechaLarga(
  valor: FechaEntrada | null | undefined
): string {
  const f = parseFecha(valor)
  if (!f) return ''
  const dia = DIAS_SEMANA_LARGOS[(f.getDay() + 6) % 7]
  return `${dia}, ${f.getDate()} de ${MESES_LARGOS[f.getMonth()]} de ${f.getFullYear()}`
}

/** «12–18 nov 2026», «28 nov – 3 dic 2026» o «28 dic 2026 – 3 ene 2027». */
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

/** «6 noches · sáb, 12 nov → vie, 18 nov». */
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

/** «8 oct, 2:32 p. m.». */
export function formatFechaHora(
  valor: FechaEntrada | null | undefined
): string {
  const f = parseFecha(valor)
  if (!f) return ''
  return `${formatFecha(f, { diaSemana: false })}, ${formatHora12(f)}`
}

/** «hace 2 días», «ayer», «hace 5 min», «ahora mismo». */
export function formatHaceTiempo(
  valor: FechaEntrada | null | undefined,
  ahora: Date = new Date()
): string {
  const f = parseFecha(valor)
  if (!f) return ''
  const seg = Math.round((ahora.getTime() - f.getTime()) / 1000)
  if (seg < 0 || seg < 60) return 'ahora mismo'
  const min = Math.round(seg / 60)
  if (min < 60) return `hace ${min}${NBSP}min`
  const h = Math.round(min / 60)
  if (h < 24) return h === 1 ? 'hace 1 hora' : `hace ${h} horas`
  const d = Math.round(h / 24)
  if (d === 1) return 'ayer'
  if (d < 30) return `hace ${d} días`
  const meses = Math.round(d / 30)
  if (meses < 12) return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`
  const anios = Math.round(d / 365)
  return anios <= 1 ? 'hace 1 año' : `hace ${anios} años`
}

// ─── Horas ─────────────────────────────────────────────────────────────────

/** Minutos desde medianoche de 'HH:mm' (null si no vale). */
export function minutosDelDia(valor: string | null | undefined): number | null {
  if (!valor) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(valor.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** 'HH:mm' desde minutos (se recorta a 00:00–23:59). */
export function horaDesdeMinutos(total: number): string {
  const t = Math.min(23 * 60 + 59, Math.max(0, Math.round(total)))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

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
    const total = minutosDelDia(valor)
    if (total === null) return null
    h = Math.floor(total / 60)
    min = total % 60
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

/** Cronómetro «00:24» / «1:02:03». */
export function formatCronometro(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${ss}`
    : `${String(m).padStart(2, '0')}:${ss}`
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
export function formatActividades(n: number): string {
  return plural(n, 'actividad', 'actividades')
}
/** «Faltan 23 días» · «Falta 1 día» · «Es hoy». */
export function formatFaltan(dias: number): string {
  if (dias <= 0) return 'Es hoy'
  return dias === 1 ? 'Falta 1 día' : `Faltan ${dias} días`
}

// ─── Números y dinero ──────────────────────────────────────────────────────

const SIMBOLOS: Record<string, string> = {
  USD: 'US$',
  DOP: 'RD$',
  EUR: '€',
  GBP: '£',
  MXN: 'MX$',
  COP: 'COL$',
  CAD: 'CA$',
}

/** Número en es-DO («1,284», «12.4»). */
export function formatNumero(n: number, decimales = 0): string {
  if (!Number.isFinite(n)) return '—'
  const fijo = Math.abs(n).toFixed(decimales)
  const [entero = '0', fraccion] = fijo.split('.')
  const agrupado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const signo = n < 0 && Number(fijo) !== 0 ? '-' : ''
  return `${signo}${agrupado}${fraccion ? `.${fraccion}` : ''}`
}

export interface OpcionesMoneda {
  /** 2 decimales (pagos, depósitos). Por defecto 0 (estimados). */
  decimales?: boolean
  /** Muestra siempre el signo («+US$45»). */
  signo?: boolean
}

/** Importe en es-DO: «US$1,840» · «RD$108,500» · «€1,840». */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  opciones: OpcionesMoneda = {}
): string {
  if (!Number.isFinite(amount)) return '—'
  const codigo = (currency || 'USD').toUpperCase()
  const decimales = opciones.decimales ? 2 : 0
  const cuerpo = formatNumero(Math.abs(amount), decimales)
  const simbolo = SIMBOLOS[codigo]
  const texto = simbolo ? `${simbolo}${cuerpo}` : `${codigo}${NBSP}${cuerpo}`
  const redondeado = Number(Math.abs(amount).toFixed(decimales))
  if (amount < 0 && redondeado !== 0) return `-${texto}`
  if (opciones.signo && redondeado !== 0) return `+${texto}`
  return texto
}

/** Alias en español de formatCurrency. */
export const formatMoneda = formatCurrency

/** Porcentaje «91 %» (n en 0–100). */
export function formatPorcentaje(n: number, decimales = 0): string {
  if (!Number.isFinite(n)) return '—'
  return `${formatNumero(n, decimales)}${NBSP}%`
}

/**
 * Moneda del viaje (si falta, la del formulario; si falta, USD). Se valida en
 * tiempo de ejecución: `trips.data` es jsonb y puede traer cualquier cosa.
 */
export function monedaDe(
  trip: { moneda?: unknown } | null | undefined,
  respaldo: Moneda | null | undefined = null
): Moneda {
  const m = trip?.moneda
  if (m === 'USD' || m === 'EUR' || m === 'DOP') return m
  return respaldo ?? 'USD'
}

// ─── Mapa ──────────────────────────────────────────────────────────────────

/** «18.4861° N · 69.9312° O». */
export function formatCoordenadas(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ''
  const ns = lat >= 0 ? 'N' : 'S'
  const eo = lng >= 0 ? 'E' : 'O'
  return `${Math.abs(lat).toFixed(4)}° ${ns} · ${Math.abs(lng).toFixed(4)}° ${eo}`
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${formatNumero(meters / 1000, 1)}${NBSP}km`
  return `${Math.round(meters)}${NBSP}m`
}
