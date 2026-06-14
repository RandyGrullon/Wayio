/**
 * Central configuration read from Expo public env vars (.env / app config).
 *
 * - API_URL   → the Wayio web (Next.js) deployment, used ONLY for the AI
 *               endpoints that hold secret keys (/api/generate, /api/reschedule,
 *               /api/validate). For local dev point it at your machine's LAN IP
 *               (e.g. http://192.168.1.50:3000) — "localhost" will not resolve
 *               from a physical phone.
 * - WEB_URL   → the public web app, opened in-app for Stripe checkout.
 */
export const config = {
  apiUrl: (process.env['EXPO_PUBLIC_API_URL'] ?? '').replace(/\/$/, ''),
  webUrl: (process.env['EXPO_PUBLIC_WEB_URL'] ?? '').replace(/\/$/, ''),
  supabaseUrl: process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? '',
  supabaseAnonKey: process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? '',
  mapboxToken: process.env['EXPO_PUBLIC_MAPBOX_TOKEN'] ?? '',
} as const

export function assertBackendConfigured(): void {
  if (!config.apiUrl) {
    throw new Error(
      'EXPO_PUBLIC_API_URL no está configurado. Apúntalo a tu servidor web Wayio.'
    )
  }
}
