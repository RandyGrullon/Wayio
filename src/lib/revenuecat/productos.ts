import 'server-only'
import type { PlanKey } from '@/constants/pricing'

/**
 * Productos de las tiendas (App Store y Google Play) y su plan de Wayio.
 *
 * Los ids los eliges tú al crear los productos (API-KEYS-GUIA.md, sección
 * 6b) y deben coincidir EXACTAMENTE con estos. RevenueCat los manda en el
 * webhook tal cual; en Google Play las suscripciones llegan como
 * «suscripción:plan base» (`wayio_pro:mensual`).
 *
 * El «Pase Pro de 30 días» no se renueva: en el App Store es una suscripción
 * NO renovable y en Google Play un producto único consumible (se puede volver
 * a comprar para otro viaje). El servidor le da 30 días desde la compra.
 */
export const PRODUCTOS_TIENDA: Readonly<Record<string, PlanKey>> = {
  // App Store
  wayio_pro_mensual: 'pro_mensual',
  wayio_pro_anual: 'pro_anual',
  wayio_pase_30_dias: 'pro_por_viaje',
  // Google Play: suscripción `wayio_pro` con los planes base `mensual` y
  // `anual`; el pase, producto único `wayio_pase_30_dias` (arriba).
  'wayio_pro:mensual': 'pro_mensual',
  'wayio_pro:anual': 'pro_anual',
}

/** Entitlement de RevenueCat que da Wayio Pro. */
export const ENTITLEMENT_PRO = 'pro'

/** Días que da el Pase Pro de 30 días comprado en la tienda. */
export const DIAS_PASE_TIENDA = 30

/** Plan de un producto de la tienda (null si no está en el catálogo). */
export function planDeProducto(productId: string | null): PlanKey | null {
  if (!productId) return null
  return Object.prototype.hasOwnProperty.call(PRODUCTOS_TIENDA, productId)
    ? (PRODUCTOS_TIENDA[productId] ?? null)
    : null
}
