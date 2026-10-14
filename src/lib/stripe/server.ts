import 'server-only'
import Stripe from 'stripe'
import { requireEnv } from '@/lib/utils/env'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-04-22.dahlia',
      typescript: true,
    })
  }
  return _stripe
}

export function getStripePriceId(env: string): string {
  return requireEnv(env)
}

/**
 * Returns true when the Stripe secret key is present in the environment.
 * Use this to degrade gracefully instead of throwing when Stripe is not
 * configured.
 */
export function isStripeConfigured(): boolean {
  return Boolean(process.env['STRIPE_SECRET_KEY'])
}

/** ¿Está configurado el secreto de firma del webhook? */
export function isStripeWebhookConfigured(): boolean {
  return isStripeConfigured() && Boolean(process.env['STRIPE_WEBHOOK_SECRET'])
}

/**
 * Depósito de reserva: SOLO se ofrece si el dueño lo activa explícitamente
 * con NEXT_PUBLIC_RESERVAS_ENABLED=true. Hoy no hay un proveedor real de
 * reservas detrás, así que cobrar un "depósito" tiene riesgo legal y de
 * contracargos: por defecto queda desactivado.
 */
export function reservasHabilitadas(): boolean {
  return process.env['NEXT_PUBLIC_RESERVAS_ENABLED'] === 'true'
}

/** Id de un objeto expandible de Stripe (string o { id }). */
export function idDe(
  v: string | { id: string } | null | undefined
): string | null {
  if (!v) return null
  return typeof v === 'string' ? v : v.id
}
