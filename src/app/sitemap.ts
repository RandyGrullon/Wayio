import type { MetadataRoute } from 'next'
import { DESTINOS } from '@/lib/seo/destinos'
import { getBaseUrl } from '@/lib/utils/baseUrl'

/**
 * Sitemap público: home, planificador, precios, páginas legales y las
 * landings de destinos. Las páginas privadas (cuenta, viajes, grupos, admin)
 * no se publican aquí.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getBaseUrl()
  const ahora = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: ahora,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/precios`,
      lastModified: ahora,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/planificar`,
      lastModified: ahora,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    ...['privacidad', 'terminos', 'contacto'].map((ruta) => ({
      url: `${base}/${ruta}`,
      lastModified: ahora,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ]

  const destinoPages: MetadataRoute.Sitemap = DESTINOS.map((d) => ({
    url: `${base}/viaje/${d.slug}`,
    lastModified: ahora,
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }))

  return [...staticPages, ...destinoPages]
}
