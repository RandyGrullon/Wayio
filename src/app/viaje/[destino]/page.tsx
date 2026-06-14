import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { DESTINOS, getDestino } from '@/lib/seo/destinos'
import { buildTravelActionSchema } from '@/lib/seo/schemas'

type Props = { params: Promise<{ destino: string }> }

export async function generateStaticParams() {
  return DESTINOS.map((d) => ({ destino: d.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { destino: slug } = await params
  const destino = getDestino(slug)
  if (!destino) return {}

  const base = process.env['NEXT_PUBLIC_BASE_URL'] ?? 'https://wayio.app'
  const url = `${base}/viaje/${slug}`

  return {
    title: `Itinerario ${destino.diasRecomendados} días en ${destino.nombre} — Wayio`,
    description: destino.descripcion,
    keywords: destino.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: `Viaje a ${destino.nombre}: itinerario con IA`,
      description: destino.descripcion,
      url,
      type: 'website',
      images: [
        {
          url: destino.imagen,
          width: 1200,
          height: 630,
          alt: destino.nombre,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Viaje a ${destino.nombre} — Wayio`,
      description: destino.descripcion,
      images: [destino.imagen],
    },
  }
}

const SAMPLE_ACTIVITIES = [
  { emoji: '🗺️', label: 'Planificación IA del itinerario completo' },
  { emoji: '📍', label: 'GPS en vivo con alertas de proximidad' },
  { emoji: '🏨', label: 'Recomendaciones de hoteles optimizadas' },
  { emoji: '🍽️', label: 'Los mejores restaurantes locales' },
  { emoji: '🔔', label: 'Alertas inteligentes de demoras y cambios' },
  { emoji: '👥', label: 'Sala grupal para viajes en equipo' },
]

export default async function DestinoPage({ params }: Props) {
  const { destino: slug } = await params
  const destino = getDestino(slug)
  if (!destino) notFound()

  const schema = buildTravelActionSchema(destino)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <div className="bg-aurora min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          {/* Hero */}
          <div className="mb-10 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-600">
              {destino.pais}
            </p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-fg sm:text-6xl">
              Viaje a <span className="text-gradient">{destino.nombre}</span>
            </h1>
            <p className="mt-4 text-lg text-fg-muted">{destino.descripcion}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {destino.keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>

          {/* Quick facts */}
          <div className="mb-10 grid grid-cols-2 gap-4 rounded-3xl border border-border bg-surface p-6 shadow-[var(--shadow-soft)] sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-fg-subtle">
                Días recomendados
              </p>
              <p className="mt-1 text-2xl font-extrabold text-fg">
                {destino.diasRecomendados}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-fg-subtle">
                Mejor época
              </p>
              <p className="mt-1 text-sm font-semibold text-fg">
                {destino.mejorEpoca}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-bold uppercase tracking-wider text-fg-subtle">
                País
              </p>
              <p className="mt-1 text-sm font-semibold text-fg">
                {destino.pais}
              </p>
            </div>
          </div>

          {/* What Wayio includes */}
          <section className="mb-10">
            <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-fg">
              Tu itinerario a {destino.nombreCorto} incluye
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {SAMPLE_ACTIVITIES.map(({ emoji, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
                >
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-sm font-semibold text-fg">{label}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* CTA */}
          <div className="grad-brand relative overflow-hidden rounded-[2rem] px-8 py-12 text-center text-white">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Planifica tu viaje a {destino.nombreCorto} ahora
            </h2>
            <p className="mt-2 text-white/80">
              Gratis en minutos. IA que conoce {destino.nombreCorto} de punta a
              punta.
            </p>
            <Link
              href={`/?destino=${destino.slug}`}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-brand-700 shadow-lg transition-transform hover:-translate-y-0.5"
            >
              Crear mi itinerario gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Other destinations */}
          <section className="mt-12">
            <h2 className="mb-4 text-lg font-bold text-fg">
              Otros destinos populares
            </h2>
            <div className="flex flex-wrap gap-2">
              {DESTINOS.filter((d) => d.slug !== slug)
                .slice(0, 12)
                .map((d) => (
                  <Link
                    key={d.slug}
                    href={`/viaje/${d.slug}`}
                    className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:border-brand-400 hover:text-brand-600"
                  >
                    {d.nombreCorto}
                  </Link>
                ))}
            </div>
          </section>
        </main>
      </div>
    </>
  )
}
