import type { MetadataRoute } from 'next'

/**
 * Manifiesto PWA (docs/DISENO.md §8.3). Genera /manifest.webmanifest, que
 * sw.js precachea. Los PNG salen de scripts/brand/generar-iconos.mjs.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wayio',
    short_name: 'Wayio',
    description:
      'Tu próximo viaje, trazado día a día. Planificador de viajes con IA: tres versiones de tu itinerario con horarios, mapa y presupuesto.',
    lang: 'es',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#F7F4EE',
    background_color: '#F7F4EE',
    categories: ['travel', 'lifestyle'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
