import 'server-only'
import type { PlanKey } from '@/constants/pricing'

/**
 * Productos de las tiendas (App Store y Google Play) y su plan de Wayio.
 *
 * Con los ids recomendados (API-KEYS-GUIA.md, sección 6b) no hay que
 * configurar nada. Si en las tiendas usas otros, ponlos en las variables
 * (separados por comas) o déjalos: un producto desconocido se deduce del
 * evento (compra no renovable = pase; si no, por la duración: más de 100
 * días = anual) y se avisa en el registro para añadirlo.
 *
 *   REVENUECAT_PRODUCTOS_MENSUAL  wayio_pro_mensual,wayio_pro:mensual
 *   REVENUECAT_PRODUCTOS_ANUAL    wayio_pro_anual,wayio_pro:anual
 *   REVENUECAT_PRODUCTOS_PASE     wayio_pase_30_dias
 *   REVENUECAT_ENTITLEMENT        pro
 *
 * En Google Play las suscripciones llegan como «suscripción:plan base»
 * (`wayio_pro:mensual`). El «Pase Pro de 30 días» no se renueva: en el App
 * Store es una suscripción NO renovable y en Google Play un producto único
 * consumible (se puede volver a comprar). El servidor le da 30 días.
 */

const POR_DEFECTO: Readonly<Record<PlanKey, string>> = {
  pro_mensual: 'wayio_pro_mensual,wayio_pro:mensual',
  pro_anual: 'wayio_pro_anual,wayio_pro:anual',
  pro_por_viaje: 'wayio_pase_30_dias',
  pro_grupo: '',
}

const VARIABLE: Readonly<Record<PlanKey, string | null>> = {
  pro_mensual: 'REVENUECAT_PRODUCTOS_MENSUAL',
  pro_anual: 'REVENUECAT_PRODUCTOS_ANUAL',
  pro_por_viaje: 'REVENUECAT_PRODUCTOS_PASE',
  pro_grupo: null,
}

const lista = (texto: string): string[] =>
  texto
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

/** Catálogo producto → plan, leído de las variables en cada llamada. */
export function productosTienda(): ReadonlyMap<string, PlanKey> {
  const mapa = new Map<string, PlanKey>()
  for (const plan of Object.keys(POR_DEFECTO) as PlanKey[]) {
    const variable = VARIABLE[plan]
    const valor = (variable && process.env[variable]?.trim()) || ''
    for (const id of lista(valor || POR_DEFECTO[plan])) mapa.set(id, plan)
  }
  return mapa
}

/** Entitlement de RevenueCat que da Wayio Pro. */
export function entitlementPro(): string {
  return process.env['REVENUECAT_ENTITLEMENT']?.trim() || 'pro'
}

/** Días que da el Pase Pro de 30 días comprado en la tienda. */
export const DIAS_PASE_TIENDA = 30

/** Plan de un producto de la tienda (null si no está en el catálogo). */
export function planDeProducto(productId: string | null): PlanKey | null {
  if (!productId) return null
  return productosTienda().get(productId) ?? null
}
