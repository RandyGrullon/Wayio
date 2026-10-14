import 'server-only'
import { after } from 'next/server'
import { PostHog } from 'posthog-node'
import type { ServerAnalyticsEvent } from './types'

/**
 * PostHog en el servidor (webhooks, referidos…).
 *
 * - Sin NEXT_PUBLIC_POSTHOG_KEY es un no-op: nunca lanza (posthog-node sí lanza
 *   si se le pasa una key vacía).
 * - Pensado para serverless: cada evento se envía al momento (captureImmediate)
 *   y, dentro de una petición, después de responder con after(), así no se
 *   pierde al congelarse la función ni retrasa la respuesta.
 */

const DEFAULT_HOST = 'https://us.i.posthog.com'

let cliente: PostHog | null = null
let intentado = false

/** Cliente de PostHog del servidor, o null si no está configurado. */
export function getPostHogServer(): PostHog | null {
  if (intentado) return cliente
  intentado = true
  const key = process.env['NEXT_PUBLIC_POSTHOG_KEY']?.trim()
  if (!key) return null
  try {
    cliente = new PostHog(key, {
      host: process.env['NEXT_PUBLIC_POSTHOG_HOST']?.trim() || DEFAULT_HOST,
      flushAt: 1,
      flushInterval: 0,
    })
  } catch {
    cliente = null
  }
  return cliente
}

/** Envía el evento y espera a que salga. Nunca lanza. */
export async function captureServerEvent(
  userId: string,
  event: ServerAnalyticsEvent | (string & {}),
  properties?: Record<string, unknown>
): Promise<void> {
  const ph = getPostHogServer()
  if (!ph || !userId) return
  try {
    await ph.captureImmediate({
      distinctId: userId,
      event,
      ...(properties !== undefined ? { properties } : {}),
    })
  } catch {
    /* la analítica nunca tumba un handler */
  }
}

/**
 * Registra un evento sin bloquear la respuesta. Dentro de una petición usa
 * after(); fuera de ella (scripts, tests) lo envía en segundo plano.
 */
export function trackServerEvent(
  userId: string,
  event: ServerAnalyticsEvent | (string & {}),
  properties?: Record<string, unknown>
): void {
  if (!getPostHogServer()) return
  const enviar = (): Promise<void> =>
    captureServerEvent(userId, event, properties)
  try {
    after(enviar)
  } catch {
    // after() lanza fuera del contexto de una petición.
    void enviar()
  }
}
