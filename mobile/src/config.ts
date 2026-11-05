/**
 * Configuración central leída de las variables públicas de Expo (.env).
 *
 * - API_URL   → el backend web de Wayio (Next.js): endpoints de IA (generate,
 *               adjust, reschedule, validate, interpret, analyze-video…),
 *               búsquedas (hotels, activities, flights) y Stripe. TODAS las
 *               llamadas llevan `Authorization: Bearer <access_token>` de la
 *               sesión de Supabase (lib/api/http.ts). En desarrollo apúntalo a
 *               la IP LAN de tu PC (p. ej. http://192.168.1.50:3000):
 *               «localhost» no resuelve desde un teléfono físico.
 * - WEB_URL   → la web pública: recuperar contraseña, páginas legales y
 *               enlaces para compartir el viaje o el grupo.
 * - RESERVAS_ENABLED → 'true' muestra «Reservar con depósito (15 %)». Por
 *               defecto apagado; debe coincidir con NEXT_PUBLIC_RESERVAS_ENABLED
 *               del servidor (si no, el checkout responde 403).
 * - GEO_PROVEEDOR → quién geocodifica en el backend. Por defecto 'geoapify':
 *               el mapa muestra «Powered by Geoapify», que su plan Free exige
 *               donde se ven sus coordenadas. Pon 'osm' solo si el servidor no
 *               tiene GEOAPIFY_API_KEY.
 * - COMPRAS_TIENDA → 'true' vende Pro con compras integradas (App Store y
 *               Google Play vía RevenueCat) en vez del pago web. Por defecto
 *               apagado (la app abre el pago web como hasta ahora). Necesita
 *               un development build (no Expo Go) y las claves públicas de
 *               RevenueCat de cada tienda: REVENUECAT_IOS_KEY (appl_…) y
 *               REVENUECAT_ANDROID_KEY (goog_…). Sin la clave de la
 *               plataforma, esa build sigue con el pago web.
 * - CHECKOUT_WEB_EEUU → 'true' ofrece ADEMÁS el pago web cuando la cuenta de
 *               la tienda es de EE. UU. (allí Apple y Google permiten enlazar
 *               a un pago externo). Fuera de EE. UU. siempre se usa la tienda.
 */
export const config = {
  apiUrl: (process.env['EXPO_PUBLIC_API_URL'] ?? '').replace(/\/$/, ''),
  webUrl: (process.env['EXPO_PUBLIC_WEB_URL'] ?? '').replace(/\/$/, ''),
  supabaseUrl: process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? '',
  supabaseAnonKey: process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? '',
  mapboxToken: process.env['EXPO_PUBLIC_MAPBOX_TOKEN'] ?? '',
  /** Reservas con depósito (Stripe) activas en esta build. */
  reservasActivas: process.env['EXPO_PUBLIC_RESERVAS_ENABLED'] === 'true',
  /** Créditos de Geoapify en el mapa (salvo que el backend use solo OSM). */
  creditosGeoapify: process.env['EXPO_PUBLIC_GEO_PROVEEDOR'] !== 'osm',
  /** Compras integradas (RevenueCat) en vez del pago web. */
  comprasTienda: process.env['EXPO_PUBLIC_COMPRAS_TIENDA'] === 'true',
  /** Clave pública de RevenueCat del App Store (appl_…). */
  revenuecatIos: process.env['EXPO_PUBLIC_REVENUECAT_IOS_KEY'] ?? '',
  /** Clave pública de RevenueCat de Google Play (goog_…). */
  revenuecatAndroid: process.env['EXPO_PUBLIC_REVENUECAT_ANDROID_KEY'] ?? '',
  /** Pago web también para cuentas de la tienda de EE. UU. */
  checkoutWebEeuu: process.env['EXPO_PUBLIC_CHECKOUT_WEB_EEUU'] === 'true',
} as const

export function assertBackendConfigured(): void {
  if (!config.apiUrl) {
    throw new Error(
      'EXPO_PUBLIC_API_URL no está configurado. Apúntalo a tu servidor web Wayio.'
    )
  }
}
