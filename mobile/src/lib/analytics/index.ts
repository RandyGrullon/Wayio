import { capturar } from './cliente'
import type { AnalyticsEvent, AnalyticsEventProps, TrackArgs } from './types'

export type {
  AnalyticsEvent,
  AnalyticsEventProps,
  CategoriaAfiliado,
  ProveedorAfiliado,
} from './types'
export { analiticaActiva } from './cliente'

/**
 * Registra un evento de producto en PostHog, como `track` de la web.
 *
 * Tipado por evento: `track('click_afiliado', { proveedor: 'viator',
 * categoria: 'actividad' })`. Es no-op sin EXPO_PUBLIC_POSTHOG_KEY y nunca
 * lanza excepciones.
 */
export function track<E extends AnalyticsEvent>(
  event: E,
  ...args: TrackArgs<E>
): void {
  try {
    const [properties] = args
    // Quitamos las claves undefined para no ensuciar los eventos.
    const limpias: Record<string, unknown> = {}
    if (properties !== undefined) {
      for (const [k, v] of Object.entries(
        properties as AnalyticsEventProps[E] & object
      )) {
        if (v !== undefined) limpias[k] = v
      }
    }
    capturar(event, limpias)
  } catch {
    // La analítica nunca rompe la app.
  }
}
