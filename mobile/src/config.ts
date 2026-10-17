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
} as const

export function assertBackendConfigured(): void {
  if (!config.apiUrl) {
    throw new Error(
      'EXPO_PUBLIC_API_URL no está configurado. Apúntalo a tu servidor web Wayio.'
    )
  }
}
