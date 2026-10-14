import { PLANS, type PlanKey } from '@/constants/pricing'
import {
  formatCurrency,
  formatFecha,
  formatHora12,
  formatNumero,
} from '@/lib/utils/formatters'

/**
 * Etiquetas en español y formatos es-DO del panel. Sirve en servidor y en
 * cliente (sin hooks ni APIs del navegador).
 */

export const ETIQUETA_ROL: Record<string, string> = {
  admin: 'Admin',
  user: 'Usuario',
}

export const ETIQUETA_NIVEL: Record<string, string> = {
  free: 'Gratis',
  pro: 'Pro',
  grupo: 'Grupo',
}

export const ETIQUETA_PAQUETE: Record<string, string> = {
  basico: 'Básico',
  confort: 'Confort',
  premium: 'Premium',
}

export const ETIQUETA_PLATAFORMA: Record<string, string> = {
  all: 'Todas',
  web: 'Web',
  mobile: 'App móvil',
}

export const ETIQUETA_NIVEL_ANUNCIO: Record<string, string> = {
  info: 'Información',
  warning: 'Aviso',
  critical: 'Crítico',
}

export const ETIQUETA_PROVEEDOR_IA: Record<string, string> = {
  anthropic: 'Anthropic',
  groq: 'Groq',
}

export const ETIQUETA_TIPO_ACTIVIDAD: Record<string, string> = {
  museo: 'Museo',
  restaurante: 'Restaurante',
  templo: 'Templo',
  parque: 'Parque',
  barrio: 'Barrio',
  playa: 'Playa',
  actividad: 'Actividad',
  traslado: 'Traslado',
}

/** Etiqueta legible de un valor desconocido («en_viaje» → «En viaje»). */
export function legible(valor: string | null | undefined): string {
  if (!valor) return '—'
  const t = valor.replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function etiqueta(
  tabla: Record<string, string>,
  valor: string | null | undefined
): string {
  return (valor ? tabla[valor] : undefined) ?? legible(valor)
}

/** Nombre comercial de un plan («Pro Viajero Mensual», «Gratis»). */
export function nombrePlan(planId: string | null | undefined): string {
  if (!planId || planId === 'free') return 'Gratis'
  const plan = Object.prototype.hasOwnProperty.call(PLANS, planId)
    ? PLANS[planId as PlanKey]
    : undefined
  return plan?.nombre ?? legible(planId)
}

/**
 * De dónde viene una suscripción: «Concedido» (a mano desde el panel, no
 * suma al MRR), «Stripe» (cobrada) o «Sistema» (alta gratuita).
 */
export function origenSuscripcion(sub: {
  source?: string | null | undefined
  stripe_subscription_id?: string | null | undefined
  plan_id: string
}): { label: string; variant: 'laton' | 'brand' | 'default' } {
  if (sub.source === 'admin') return { label: 'Concedido', variant: 'laton' }
  if (sub.source === 'stripe' || sub.stripe_subscription_id) {
    return { label: 'Stripe', variant: 'brand' }
  }
  // Sin la migración (sin columna source): plan de pago sin Stripe = a mano.
  if (sub.source === undefined && sub.plan_id !== 'free') {
    return { label: 'Concedido', variant: 'laton' }
  }
  return { label: 'Sistema', variant: 'default' }
}

/** Opciones del select de plan (Gratis + los planes de pago). */
export const OPCIONES_PLAN: readonly { value: string; label: string }[] = [
  { value: 'free', label: 'Gratis' },
  ...Object.values(PLANS).map((p) => ({ value: p.id, label: p.nombre })),
]

// ─── Fechas (hora de República Dominicana) ────────────────────────────────

const ZONA = 'America/Santo_Domingo'
let partesRD: Intl.DateTimeFormat | null = null

/**
 * Convierte un instante (ISO con zona) a un Date cuyos campos LOCALES son la
 * hora de Santo Domingo. Así el texto es el mismo en un servidor en UTC y en
 * cualquier navegador, y los formatters es-DO lo muestran tal cual.
 */
export function enHoraRD(
  valor: string | number | Date | null | undefined
): Date | null {
  if (valor === null || valor === undefined || valor === '') return null
  const d = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(d.getTime())) return null
  partesRD ??= new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const partes = partesRD.formatToParts(d)
  const n = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((p) => p.type === tipo)?.value ?? 0)
  return new Date(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'))
}

/** «12 nov 2026» (instante en hora de RD). */
export function fecha(valor: string | null | undefined): string {
  const d = enHoraRD(valor)
  return d ? formatFecha(d, { anio: true, diaSemana: false }) : '—'
}

/** «12 nov 2026, 9:30 a. m.» (instante en hora de RD). */
export function fechaHora(valor: string | null | undefined): string {
  const d = enHoraRD(valor)
  if (!d) return '—'
  return `${formatFecha(d, { anio: true, diaSemana: false })}, ${formatHora12(d)}`
}

// ─── Números y dinero ─────────────────────────────────────────────────────

/** Importes de pagos en USD (planes, MRR): «US$6.99». */
export function usd(n: number): string {
  return formatCurrency(n, 'USD', { decimales: true })
}

let usdFino: Intl.NumberFormat | null = null

/** Costes de IA (céntimos y fracciones): «US$0.0123». */
export function usdPreciso(n: number): string {
  if (!Number.isFinite(n)) return '—'
  usdFino ??= new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
  return usdFino.format(n)
}

/** «1,284 usuarios» · «1 usuario». */
export function cantidad(n: number, uno: string, varios: string): string {
  return `${formatNumero(n)} ${n === 1 ? uno : varios}`
}

/** Primeros 8 caracteres de un id («3f2a9c1e…»). */
export function idCorto(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}
