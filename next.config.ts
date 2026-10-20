import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  env: {
    // Proveedor de geocodificación y rutas, para los créditos del mapa en el
    // navegador: 'geoapify' si hay GEOAPIFY_API_KEY, 'osm' (Nominatim + OSRM)
    // si no. Se incrusta al compilar y SOLO expone el nombre, nunca la clave.
    WAYIO_GEO_PROVEEDOR: process.env.GEOAPIFY_API_KEY?.trim()
      ? 'geoapify'
      : 'osm',
  },
  serverExternalPackages: [
    '@ffmpeg-installer/ffmpeg',
    'fluent-ffmpeg',
    'yt-dlp-exec',
  ],
  async redirects() {
    // Enlaces antiguos de la landing. Se resuelven aquí (307 real, antes de
    // renderizar) para que «/» no lea searchParams y quede estática. La query
    // original pasa sola al destino.
    return [
      {
        source: '/',
        has: [{ type: 'query', key: 'destino', value: '(?<destino>.*\\S.*)' }],
        destination: '/planificar',
        permanent: false,
      },
      {
        // «Restaurar tras el login» (DA-14): el flujo vive en /planificar.
        source: '/',
        has: [{ type: 'query', key: 'restaurar', value: '1' }],
        destination: '/planificar?paso=itinerario',
        permanent: false,
      },
      {
        // Alias corto de la página de planes; la URL indexada es /precios.
        // Temporal (307): un 308 se queda en la caché del navegador.
        source: '/planes',
        destination: '/precios',
        permanent: false,
      },
    ]
  },
  async headers() {
    return [
      {
        // El service worker nunca se cachea: así cada despliegue llega enseguida
        // a los usuarios y una versión rota no se queda pegada.
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

const env = (name: string): string | undefined => {
  const v = process.env[name]?.trim()
  return v ? v : undefined
}

const sentryOrg = env('SENTRY_ORG')
const sentryProject = env('SENTRY_PROJECT')
const sentryAuthToken = env('SENTRY_AUTH_TOKEN')

// Los sourcemaps solo se suben si hay token, organización y proyecto. Sin
// ellos el build funciona igual (los errores llegan, pero sin código legible).
const subirSourcemaps = Boolean(sentryAuthToken && sentryOrg && sentryProject)

export default withSentryConfig(nextConfig, {
  ...(sentryOrg !== undefined ? { org: sentryOrg } : {}),
  ...(sentryProject !== undefined ? { project: sentryProject } : {}),
  ...(sentryAuthToken !== undefined ? { authToken: sentryAuthToken } : {}),
  silent: !process.env['CI'],
  telemetry: false,
  widenClientFileUpload: subirSourcemaps,
  sourcemaps: {
    disable: !subirSourcemaps,
    deleteSourcemapsAfterUpload: true,
  },
  // Un fallo al subir sourcemaps no debe tumbar el despliegue.
  errorHandler: () => {},
})
