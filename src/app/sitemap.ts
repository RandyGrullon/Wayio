import type { MetadataRoute } from 'next'
import { DESTINOS } from '@/lib/seo/destinos'

const BASE_URL = process.env['NEXT_PUBLIC_BASE_URL'] ?? 'https://wayio.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${BASE_URL}/precios`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/dashboard`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ]

  const destinoPages: MetadataRoute.Sitemap = DESTINOS.map((d) => ({
    url: `${BASE_URL}/viaje/${d.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }))

  return [...staticPages, ...destinoPages]
}
