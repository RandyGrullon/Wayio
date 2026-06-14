import type { Destino } from './destinos'

const BASE_URL = process.env['NEXT_PUBLIC_BASE_URL'] ?? 'https://wayio.app'

export interface TravelActionSchema {
  '@context': 'https://schema.org'
  '@type': 'TravelAction'
  name: string
  description: string
  location: {
    '@type': 'Place'
    name: string
    address: { '@type': 'PostalAddress'; addressCountry: string }
  }
  agent: {
    '@type': 'SoftwareApplication'
    name: string
    applicationCategory: string
    url: string
  }
  object: {
    '@type': 'Trip'
    name: string
    description: string
    itinerary: { '@type': 'Place'; name: string }[]
    offers: {
      '@type': 'Offer'
      price: string
      priceCurrency: string
      url: string
    }
  }
}

export function buildTravelActionSchema(destino: Destino): TravelActionSchema {
  const pageUrl = `${BASE_URL}/viaje/${destino.slug}`
  return {
    '@context': 'https://schema.org',
    '@type': 'TravelAction',
    name: `Planificar viaje a ${destino.nombre}`,
    description: destino.descripcion,
    location: {
      '@type': 'Place',
      name: destino.nombre,
      address: { '@type': 'PostalAddress', addressCountry: destino.pais },
    },
    agent: {
      '@type': 'SoftwareApplication',
      name: 'Wayio',
      applicationCategory: 'TravelApplication',
      url: BASE_URL,
    },
    object: {
      '@type': 'Trip',
      name: `Itinerario ${destino.diasRecomendados} días en ${destino.nombre}`,
      description: `Plan de viaje optimizado con IA para ${destino.nombre}. ${destino.mejorEpoca}.`,
      itinerary: [{ '@type': 'Place', name: destino.nombre }],
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        url: pageUrl,
      },
    },
  }
}

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Wayio',
    url: BASE_URL,
    description: 'Planificador de viajes con inteligencia artificial',
  }
}
