import type { MetadataRoute } from 'next'
import { getBaseUrl } from '@/lib/utils/baseUrl'

/**
 * robots.txt: se indexan la home, /precios y las landings /viaje/*; nunca las
 * API, el panel admin ni las páginas privadas o de viajes de usuarios.
 * En los despliegues de vista previa de Vercel no se indexa nada.
 *
 * Los lectores de vistas previas (WhatsApp usa facebookexternalhit, X,
 * Telegram, Slack…) sí pueden leer /viaje-compartido/ para pintar la tarjeta
 * con su opengraph-image; la página ya lleva robots noindex, así que no se
 * indexa. Un bot con grupo propio ignora el grupo «*», por eso se repite la
 * lista de rutas privadas.
 */
const PRIVADAS = [
  '/api/',
  '/admin',
  '/trip/',
  '/group/',
  '/auth/',
  '/cuenta',
  '/viajes',
]

const VISTAS_PREVIAS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'TelegramBot',
  'Slackbot-LinkExpanding',
  'LinkedInBot',
  'Discordbot',
]

export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl()

  if (process.env['VERCEL_ENV'] === 'preview') {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [...PRIVADAS, '/viaje-compartido/'],
      },
      {
        userAgent: VISTAS_PREVIAS,
        allow: ['/', '/viaje-compartido/'],
        disallow: PRIVADAS,
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
