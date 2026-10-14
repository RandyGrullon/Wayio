import { getBaseUrl } from '@/lib/utils/baseUrl'
import type { Destino } from './destinos'

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
  const base = getBaseUrl()
  const pageUrl = `${base}/viaje/${destino.slug}`
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
      url: base,
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

/** JSON-LD FAQPage de las preguntas frecuentes de un destino. */
export function buildFaqSchema(
  preguntas: readonly { pregunta: string; respuesta: string }[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: preguntas.map((q) => ({
      '@type': 'Question',
      name: q.pregunta,
      acceptedAnswer: { '@type': 'Answer', text: q.respuesta },
    })),
  } as const
}

/** JSON-LD BreadcrumbList: Destinos › País › Destino. */
export function buildBreadcrumbSchema(destino: Destino) {
  const base = getBaseUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Destinos',
        item: `${base}/#destinos`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: destino.nombre,
        item: `${base}/viaje/${destino.slug}`,
      },
    ],
  } as const
}

/**
 * Serializa JSON-LD para <script type="application/ld+json"> sin que un
 * texto pueda cerrar la etiqueta (escapa <, > y &).
 */
export function jsonLd(datos: unknown): string {
  return JSON.stringify(datos)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

export function buildOrganizationSchema() {
  const base = getBaseUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Wayio',
    url: base,
    description: 'Planificador de viajes con inteligencia artificial',
  }
}
