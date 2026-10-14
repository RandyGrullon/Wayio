/**
 * URL pública base de la app (sin barra final). Única fuente de verdad para
 * metadata, sitemap, JSON-LD, redirects de auth y URLs de retorno de Stripe.
 *
 * Usa NEXT_PUBLIC_BASE_URL (o NEXT_PUBLIC_SITE_URL por compatibilidad). En
 * Vercel, si falta, usa la URL del despliegue. En local, localhost:3000.
 */
export function getBaseUrl(): string {
  const explicit =
    process.env['NEXT_PUBLIC_BASE_URL'] ?? process.env['NEXT_PUBLIC_SITE_URL']
  if (explicit && /^https?:\/\//.test(explicit)) {
    return explicit.replace(/\/+$/, '')
  }
  const vercel =
    process.env['VERCEL_PROJECT_PRODUCTION_URL'] ?? process.env['VERCEL_URL']
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`
  return 'http://localhost:3000'
}

/**
 * Devuelve `next` solo si es una ruta relativa interna segura ("/algo"); si no,
 * `fallback`. Evita open redirects del tipo "//evil.com" o "@evil.com".
 */
export function safeRedirectPath(next: unknown, fallback = '/'): string {
  if (typeof next !== 'string') return fallback
  const v = next.trim()
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) {
    return fallback
  }
  if (/[\r\n]/.test(v)) return fallback
  return v
}
