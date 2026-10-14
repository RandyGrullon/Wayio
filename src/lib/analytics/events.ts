'use client'

import { captureClient } from './client'
import type { AnalyticsEvent, AnalyticsEventProps, TrackArgs } from './types'

export type {
  AnalyticsEvent,
  AnalyticsEventProps,
  CategoriaAfiliado,
  ProveedorAfiliado,
} from './types'
export { identifyUser, resetAnalytics } from './client'

/**
 * Registra un evento de producto en PostHog (solo navegador).
 *
 * Tipado por evento: `track('click_afiliado', { proveedor: 'viator',
 * categoria: 'actividad' })`. Es no-op si PostHog no está configurado y nunca
 * lanza excepciones.
 */
export function track<E extends AnalyticsEvent>(
  event: E,
  ...args: TrackArgs<E>
): void {
  const [properties] = args
  if (properties === undefined) {
    captureClient(event)
    return
  }
  // Quitamos las claves undefined para no ensuciar los eventos.
  const limpias: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(
    properties as AnalyticsEventProps[E] & object
  )) {
    if (v !== undefined) limpias[k] = v
  }
  captureClient(event, limpias)
}
