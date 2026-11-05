import 'server-only'
import { PLANS, type PlanKey } from '@/constants/pricing'

/**
 * Cliente mínimo de la API REST de Creem (https://docs.creem.io, leída el
 * 5-nov-2026). Se usa fetch en vez del SDK `creem` para no sumar otra
 * dependencia: solo hacen falta cinco llamadas.
 *
 *   POST /v1/checkouts                     → checkout_url
 *   POST /v1/customers/billing             → customer_portal_link
 *   GET  /v1/subscriptions?subscription_id → estado actual de la suscripción
 *   POST /v1/subscriptions/{id}/cancel     → { mode: 'scheduled'|'immediate' }
 *   POST /v1/subscriptions/{id}/resume     → deshace una baja programada
 *   GET  /v1/products/{id}                 → precio del producto (verificador)
 *
 * Autenticación: cabecera x-api-key. Producción y modo test son entornos
 * separados, cada uno con su clave y su URL base:
 *   producción https://api.creem.io · test https://test-api.creem.io
 */

const URL_PRODUCCION = 'https://api.creem.io'
const URL_PRUEBA = 'https://test-api.creem.io'
const TIEMPO_MAXIMO_MS = 10_000

export function isCreemConfigured(): boolean {
  return Boolean(process.env['CREEM_API_KEY']?.trim())
}

export function isCreemWebhookConfigured(): boolean {
  return isCreemConfigured() && Boolean(process.env['CREEM_WEBHOOK_SECRET'])
}

/**
 * ¿Modo test? CREEM_TEST_MODE=true|false manda; si no está, se deduce de la
 * clave (las de prueba empiezan por creem_test_).
 */
export function creemModoPrueba(): boolean {
  const valor = process.env['CREEM_TEST_MODE']?.trim().toLowerCase()
  if (valor === 'true') return true
  if (valor === 'false') return false
  return (process.env['CREEM_API_KEY'] ?? '').trim().startsWith('creem_test_')
}

/**
 * URL base de la API. CREEM_API_URL solo sirve para apuntar a un simulador
 * local en pruebas (scripts/creem-mock.mjs); en producción no se pone.
 */
export function creemBaseUrl(): string {
  const propia = process.env['CREEM_API_URL']?.trim().replace(/\/+$/, '')
  if (propia) return propia
  return creemModoPrueba() ? URL_PRUEBA : URL_PRODUCCION
}

/** Id del producto de Creem de un plan (o null si falta la variable). */
export function productoDePlan(planId: PlanKey): string | null {
  return process.env[PLANS[planId].creemProductEnv]?.trim() || null
}

/** Plan correspondiente a un producto de Creem (mapa inverso). */
export function planDesdeProducto(
  productId: string | null | undefined
): PlanKey | null {
  if (!productId) return null
  for (const key of Object.keys(PLANS) as PlanKey[]) {
    if (productoDePlan(key) === productId) return key
  }
  return null
}

// ---------------------------------------------------------------------------
// Tipos (solo los campos que usa Wayio; Creem manda muchos más)
// ---------------------------------------------------------------------------

/** Estados de una suscripción de Creem (SubscriptionStatus). */
export type EstadoCreem =
  | 'active'
  | 'canceled'
  | 'unpaid'
  | 'paused'
  | 'trialing'
  | 'scheduled_cancel'
  | 'past_due'
  | 'incomplete'

export interface CreemCliente {
  id: string
  email?: string | null
}

export interface CreemProducto {
  id: string
  name?: string
  price?: number
  currency?: string
  billing_type?: 'recurring' | 'onetime'
  billing_period?: string
  status?: string
}

export interface CreemSuscripcion {
  id: string
  status: EstadoCreem | string
  product?: string | CreemProducto | null
  customer?: string | CreemCliente | null
  current_period_start_date?: string | null
  current_period_end_date?: string | null
  canceled_at?: string | null
  metadata?: Record<string, unknown> | null
}

export interface CreemPedido {
  id: string
  customer?: string | null
  product?: string | null
  status?: 'pending' | 'paid' | string
  type?: 'recurring' | 'onetime' | string
  created_at?: string | null
}

export interface CreemCheckout {
  id: string
  status?: string
  request_id?: string | null
  checkout_url?: string | null
  order?: CreemPedido | null
  product?: string | CreemProducto | null
  customer?: string | CreemCliente | null
  subscription?: string | CreemSuscripcion | null
  metadata?: Record<string, unknown> | null
}

/** Id de un campo que Creem manda como string o como objeto expandido. */
export function idCreem(
  v: string | { id?: unknown } | null | undefined
): string | null {
  if (!v) return null
  if (typeof v === 'string') return v || null
  return typeof v.id === 'string' && v.id ? v.id : null
}

// ---------------------------------------------------------------------------
// Llamadas
// ---------------------------------------------------------------------------

export class CreemError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly traceId: string | null = null
  ) {
    super(message)
    this.name = 'CreemError'
  }
}

async function llamar<T>(
  ruta: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<T> {
  const clave = process.env['CREEM_API_KEY']?.trim()
  if (!clave) throw new CreemError('falta CREEM_API_KEY', 0)

  const res = await fetch(`${creemBaseUrl()}${ruta}`, {
    method: init.method ?? 'GET',
    headers: {
      'x-api-key': clave,
      Accept: 'application/json',
      ...(init.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  })

  let cuerpo: unknown = null
  try {
    cuerpo = await res.json()
  } catch {
    cuerpo = null
  }
  if (!res.ok) {
    const datos = (cuerpo ?? {}) as Record<string, unknown>
    const detalle = Array.isArray(datos['message'])
      ? datos['message'].join('; ')
      : String(datos['message'] ?? datos['error'] ?? '')
    throw new CreemError(
      `Creem ${init.method ?? 'GET'} ${ruta.split('?')[0]} → HTTP ${res.status}${detalle ? `: ${detalle}` : ''}`,
      res.status,
      typeof datos['trace_id'] === 'string' ? datos['trace_id'] : null
    )
  }
  return cuerpo as T
}

export interface DatosCheckout {
  productId: string
  successUrl: string
  /** Para rastrear el checkout; Creem lo devuelve en la URL de éxito. */
  requestId: string
  /** Se copia a la suscripción: el webhook la usa para saber de quién es. */
  metadata: Record<string, string>
  /** Cliente de Creem ya conocido, o el email para rellenar el formulario. */
  cliente: { id: string } | { email: string } | null
}

export function crearCheckout(d: DatosCheckout): Promise<CreemCheckout> {
  return llamar<CreemCheckout>('/v1/checkouts', {
    method: 'POST',
    body: {
      product_id: d.productId,
      request_id: d.requestId,
      units: 1,
      success_url: d.successUrl,
      metadata: d.metadata,
      ...(d.cliente ? { customer: d.cliente } : {}),
    },
  })
}

/** Enlace al portal del cliente (método de pago, facturas, bajas). */
export async function enlacePortal(customerId: string): Promise<string> {
  const r = await llamar<{ customer_portal_link?: string }>(
    '/v1/customers/billing',
    { method: 'POST', body: { customer_id: customerId } }
  )
  if (!r.customer_portal_link) {
    throw new CreemError('Creem no devolvió el enlace del portal', 502)
  }
  return r.customer_portal_link
}

export function obtenerSuscripcion(id: string): Promise<CreemSuscripcion> {
  return llamar<CreemSuscripcion>(
    `/v1/subscriptions?subscription_id=${encodeURIComponent(id)}`
  )
}

/**
 * Baja de una suscripción. 'scheduled' = sigue activa hasta el fin del
 * periodo pagado (lo que promete la página de planes); 'immediate' = se corta
 * ya (lo usa el admin al revocar un plan).
 */
export function cancelarSuscripcion(
  id: string,
  modo: 'scheduled' | 'immediate'
): Promise<CreemSuscripcion> {
  return llamar<CreemSuscripcion>(
    `/v1/subscriptions/${encodeURIComponent(id)}/cancel`,
    {
      method: 'POST',
      body:
        modo === 'scheduled'
          ? { mode: 'scheduled', onExecute: 'cancel' }
          : { mode: 'immediate' },
    }
  )
}

/** Deshace una baja programada (scheduled_cancel → active). */
export function reanudarSuscripcion(id: string): Promise<CreemSuscripcion> {
  return llamar<CreemSuscripcion>(
    `/v1/subscriptions/${encodeURIComponent(id)}/resume`,
    { method: 'POST' }
  )
}
