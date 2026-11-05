import 'server-only'
import {
  isCreemConfigured,
  isCreemWebhookConfigured,
} from '@/lib/pagos/creem/server'
import {
  isStripeConfigured,
  isStripeWebhookConfigured,
} from '@/lib/stripe/server'
import type { SubscriptionRow } from '@/types/database'

/**
 * Proveedor de cobro de la web. Lo elige PAYMENTS_PROVIDER:
 *   - 'creem' (por defecto): Creem, merchant of record que paga a bancos de
 *     RD. Es el proveedor principal (Stripe no abre cuentas a residentes de
 *     RD).
 *   - 'stripe': el cobro original con Stripe, que queda como alternativa.
 *
 * El proveedor ACTIVO solo decide dónde se abren los checkouts nuevos. El
 * portal, la cancelación y los webhooks atienden la suscripción con el
 * proveedor que la cobró (columna `source` de subscriptions), así que cambiar
 * de proveedor no deja colgados a quienes ya pagaban con el otro.
 */

export const PROVEEDORES_PAGO = ['creem', 'stripe'] as const
export type ProveedorPago = (typeof PROVEEDORES_PAGO)[number]

/** Nombre para el panel admin (la UI de clientes NUNCA nombra al procesador). */
export const NOMBRE_PROVEEDOR: Record<ProveedorPago, string> = {
  creem: 'Creem',
  stripe: 'Stripe',
}

/** Proveedor de los checkouts nuevos (PAYMENTS_PROVIDER, por defecto creem). */
export function proveedorActivo(): ProveedorPago {
  const valor = process.env['PAYMENTS_PROVIDER']?.trim().toLowerCase()
  return valor === 'stripe' ? 'stripe' : 'creem'
}

/** ¿Tiene sus claves de API el proveedor? */
export function proveedorConfigurado(p: ProveedorPago): boolean {
  return p === 'creem' ? isCreemConfigured() : isStripeConfigured()
}

/** ¿Tiene además el secreto de firma de su webhook? */
export function webhookConfigurado(p: ProveedorPago): boolean {
  return p === 'creem'
    ? isCreemWebhookConfigured()
    : isStripeWebhookConfigured()
}

/** ¿Se puede cobrar hoy con el proveedor activo? */
export function pagosConfigurados(): boolean {
  return proveedorConfigurado(proveedorActivo())
}

/**
 * Proveedor web que cobró la suscripción de una fila, o null si no viene de
 * uno (alta gratuita, plan concedido a mano o cualquier otro origen, como una
 * compra en las tiendas de apps). Las filas anteriores a la columna `source`
 * o con source 'system' se reconocen por el prefijo del cliente: Creem usa
 * cust_… y Stripe cus_….
 */
export function proveedorDeFila(
  sub: Pick<
    SubscriptionRow,
    'source' | 'stripe_customer_id' | 'stripe_subscription_id'
  > | null
): ProveedorPago | null {
  if (!sub) return null
  if (sub.source === 'creem' || sub.source === 'stripe') return sub.source
  // 'admin' y orígenes que no son de este cobro web: nunca se tocan aquí.
  if (sub.source !== undefined && sub.source !== 'system') return null
  const cliente = sub.stripe_customer_id ?? ''
  if (cliente.startsWith('cust_')) return 'creem'
  if (cliente.startsWith('cus_')) return 'stripe'
  return sub.stripe_subscription_id ? 'stripe' : null
}
