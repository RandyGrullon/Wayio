import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Compass,
  Map as MapIcon,
  MessagesSquare,
  Share2,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Postal } from '@/components/brand/Postal'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { ButtonLink } from '@/components/ui/Button'
import { DESTINOS, getDestino } from '@/lib/seo/destinos'
import type { Destino } from '@/lib/seo/destinos'
import { getFicha, preguntasDestino } from '@/lib/seo/fichas'
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildTravelActionSchema,
  jsonLd,
} from '@/lib/seo/schemas'
import { getBaseUrl } from '@/lib/utils/baseUrl'
import {
  formatCoordenadas,
  formatDias,
  formatHora12,
  formatHora12Partes,
} from '@/lib/utils/formatters'

type Props = { params: Promise<{ destino: string }> }

export async function generateStaticParams() {
  return DESTINOS.map((d) => ({ destino: d.slug }))
}

/*
 * Solo existen las landings de DESTINOS. Un slug desconocido da un 404 real
 * (status 404) antes de renderizar: con notFound() dentro de la página, el
 * loading.tsx de la raíz ya había empezado a transmitir y salía un 200.
 */
export const dynamicParams = false

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { destino: slug } = await params
  const destino = getDestino(slug)
  if (!destino) return {}

  const url = `${getBaseUrl()}/viaje/${slug}`
  const titulo = `Viaje a ${destino.nombre}: itinerario de ${destino.diasRecomendados} días con IA`

  // La imagen social la pone opengraph-image.tsx de esta ruta (tiene
  // prioridad sobre la configuración).
  return {
    title: titulo,
    description: destino.descripcion,
    keywords: destino.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: titulo,
      description: destino.descripcion,
      url,
      type: 'website',
      locale: 'es_DO',
      siteName: 'Wayio',
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: destino.descripcion,
    },
  }
}

/** Solo funciones que la web tiene hoy (§1.3.6: nada de promesas). */
const INCLUYE: { icon: LucideIcon; titulo: string; texto: string }[] = [
  {
    icon: Compass,
    titulo: 'Tres versiones del viaje',
    texto: 'Básico, Confort y Premium, para comparar antes de elegir.',
  },
  {
    icon: CalendarDays,
    titulo: 'Horarios día a día',
    texto: 'Cada actividad con su hora, duración y tiempo entre lugares.',
  },
  {
    icon: MapIcon,
    titulo: 'Mapa con la ruta',
    texto: 'Los lugares de cada día marcados y unidos en el mapa.',
  },
  {
    icon: Wallet,
    titulo: 'Presupuesto estimado',
    texto: 'En dólares (USD), euros (EUR) o pesos dominicanos (DOP).',
  },
  {
    icon: Share2,
    titulo: 'Para compartir',
    texto: 'Un enlace de solo lectura para enviarlo por WhatsApp.',
  },
  {
    icon: MessagesSquare,
    titulo: 'Sala de grupo',
    texto: 'Chat, votos y gastos para decidir el viaje entre todos.',
  },
]

/** Cuatro destinos para seguir explorando (los siguientes de la lista). */
function otrosDestinos(slug: string): Destino[] {
  const i = DESTINOS.findIndex((d) => d.slug === slug)
  const resto: Destino[] = []
  for (let k = 1; k <= DESTINOS.length && resto.length < 4; k++) {
    const d = DESTINOS[(i + k) % DESTINOS.length]
    if (d && d.slug !== slug) resto.push(d)
  }
  return resto
}

export default async function DestinoPage({ params }: Props) {
  const { destino: slug } = await params
  const destino = getDestino(slug)
  if (!destino) notFound()

  const ficha = getFicha(slug)
  const preguntas = preguntasDestino(destino, ficha)
  const coords = ficha ? formatCoordenadas(ficha.lat, ficha.lng) : ''
  const otros = otrosDestinos(slug)
  const textoSello =
    destino.pais === destino.nombre
      ? destino.nombre
      : `${destino.nombre} · ${destino.pais}`
  const [primera, ...siguientes] = ficha?.dia ?? []

  const filas = [
    {
      etiqueta: 'Días recomendados',
      valor: formatDias(destino.diasRecomendados),
    },
    { etiqueta: 'Mejor época', valor: destino.mejorEpoca },
    { etiqueta: 'País', valor: destino.pais },
    ...(ficha
      ? [
          { etiqueta: 'Moneda', valor: ficha.moneda },
          { etiqueta: 'Idioma', valor: ficha.idioma },
          { etiqueta: 'Ideal para', valor: ficha.idealPara.join(' · ') },
        ]
      : []),
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            buildTravelActionSchema(destino),
            buildBreadcrumbSchema(destino),
            buildFaqSchema(preguntas),
          ]),
        }}
      />

      <SiteHeader />
      <main id="contenido" className="flex-1">
        {/* Portada */}
        <section data-wy-hero className="reticula">
          <div className="mx-auto max-w-content px-4 pt-8 pb-16 md:px-6 lg:px-8 lg:pt-12 lg:pb-24">
            <nav aria-label="Migas de pan">
              <ol className="flex flex-wrap items-center gap-2 text-caption text-fg-muted">
                <li>
                  <Link
                    href="/#destinos"
                    className="rounded-sm text-accent underline decoration-1 underline-offset-[3px] hover:text-accent-hover"
                  >
                    Destinos
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-fg">
                  {destino.pais === destino.nombre
                    ? destino.nombre
                    : `${destino.pais} · ${destino.nombre}`}
                </li>
              </ol>
            </nav>

            <div className="mt-8 grid gap-12 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-7">
                <p className="kicker kicker-filete">
                  <span>
                    {destino.pais}
                    {coords ? (
                      <>
                        {' · '}
                        <span className="font-mono tracking-[0.02em] normal-case [font-stretch:100%]">
                          {coords}
                        </span>
                      </>
                    ) : null}
                  </span>
                </p>
                <h1 className="mt-4 font-display text-display-l text-fg">
                  Viaje a <em className="italic">{destino.nombre}</em>
                </h1>
                <p className="mt-5 max-w-[60ch] text-lead text-fg-muted">
                  {destino.descripcion}
                </p>
                {ficha ? (
                  <ul
                    aria-label="Ideal para"
                    className="mt-5 flex flex-wrap gap-2"
                  >
                    {ficha.idealPara.map((t) => (
                      <li
                        key={t}
                        className="inline-flex h-8 items-center rounded-full bg-surface-2 px-3 text-[14px] font-medium text-fg"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-8">
                  <ButtonLink
                    href={`/planificar?destino=${encodeURIComponent(destino.slug)}`}
                    variant="primary"
                    size="lg"
                    iconEnd={<ArrowRight />}
                  >
                    Trazar {destino.nombreCorto} con IA
                  </ButtonLink>
                  <p className="mt-3 text-caption text-fg-subtle">
                    Gratis con tu cuenta · Tres versiones en uno o dos minutos
                  </p>
                </div>
              </div>

              <div className="lg:col-span-5">
                <Postal
                  semilla={destino.slug}
                  {...(ficha ? { escena: ficha.escena } : {})}
                  proporcion="4:5"
                  redondeo="sheet"
                  sello={textoSello}
                  selloTono="laton"
                  kicker={
                    ficha
                      ? `Día 01 · ${ficha.ciudad}`
                      : `Día 01 · ${destino.nombre}`
                  }
                  kickerClassName="text-dia-1"
                  titulo={primera ? primera.nombre : destino.nombre}
                  tituloComo="p"
                  arteClassName="max-lg:aspect-[4/3] max-lg:max-h-[360px]"
                >
                  {siguientes.length > 0 ? (
                    <ul className="flex flex-col gap-1 tnum">
                      {siguientes.slice(0, 3).map((act) => (
                        <li key={act.hora + act.nombre}>
                          <span className="text-fg">
                            {formatHora12(act.hora)}
                          </span>{' '}
                          {act.nombre}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    `${formatDias(destino.diasRecomendados)} · Mejor época: ${destino.mejorEpoca}`
                  )}
                </Postal>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-content gap-12 px-4 py-16 md:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8 lg:py-24">
          {/* Ficha rápida */}
          <aside
            aria-labelledby="ficha-rapida"
            className="lg:order-2 lg:col-span-4"
          >
            <div className="rounded-card border border-border bg-surface p-5 md:p-6 lg:sticky lg:top-24">
              <h2 id="ficha-rapida" className="kicker kicker-filete">
                Ficha rápida
              </h2>
              <dl className="mt-4 divide-y divide-border">
                {filas.map((f) => (
                  <div key={f.etiqueta} className="py-3">
                    <dt className="text-caption text-fg-muted">{f.etiqueta}</dt>
                    <dd className="mt-0.5 text-body-s font-medium text-fg">
                      {f.valor}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>

          <div className="flex flex-col gap-20 lg:order-1 lg:col-span-8">
            {/* Un día en … */}
            {ficha ? (
              <section aria-labelledby="un-dia">
                <p className="kicker">Ejemplo de itinerario</p>
                <h2 id="un-dia" className="mt-2 font-display text-h2 text-fg">
                  Un día en <em className="italic">{ficha.ciudad}</em>
                </h2>
                <ol className="mt-8 border-l-2 border-border">
                  {ficha.dia.map((act) => {
                    const h = formatHora12Partes(act.hora)
                    return (
                      <li
                        key={act.hora + act.nombre}
                        className="relative flex gap-4 py-4 pl-6 sm:gap-6"
                      >
                        <span
                          aria-hidden="true"
                          className="absolute top-6 -left-[7px] size-3 rounded-full border-2 border-bg bg-dia-1"
                        />
                        <p className="w-20 shrink-0 text-body-s text-fg tnum">
                          <span className="font-semibold">{h?.hora}</span>{' '}
                          <span className="text-fg-muted">{h?.periodo}</span>
                        </p>
                        <div className="min-w-0">
                          <p className="text-title text-fg">{act.nombre}</p>
                          <p className="mt-0.5 text-body-s text-fg-muted">
                            {act.nota}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
                <p className="mt-4 text-caption text-fg-subtle">
                  Ejemplo orientativo. Wayio ordena las actividades y ajusta los
                  horarios a tus fechas, tu ritmo y tu presupuesto.
                </p>
              </section>
            ) : null}

            {/* Qué incluye */}
            <section aria-labelledby="que-incluye">
              <p className="kicker">Wayio</p>
              <h2
                id="que-incluye"
                className="mt-2 font-display text-h2 text-fg"
              >
                Qué incluye tu plan
              </h2>
              <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                {INCLUYE.map(({ icon: Icono, titulo, texto }) => (
                  <li key={titulo} className="flex gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-fg">
                      <Icono
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className="size-5"
                      />
                    </span>
                    <div>
                      <p className="text-title text-fg">{titulo}</p>
                      <p className="mt-0.5 text-body-s text-fg-muted">
                        {texto}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Preguntas frecuentes */}
            <section aria-labelledby="preguntas">
              <h2 id="preguntas" className="font-display text-h2 text-fg">
                Preguntas frecuentes
              </h2>
              <div className="mt-6 divide-y divide-border border-y border-border">
                {preguntas.map((q) => (
                  <details key={q.pregunta} className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-title text-fg [&::-webkit-details-marker]:hidden">
                      {q.pregunta}
                      <ChevronDown
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className="size-5 shrink-0 text-fg-subtle transition-transform duration-(--dur-medium) ease-papel group-open:rotate-180"
                      />
                    </summary>
                    <p className="max-w-prose pb-5 text-body text-fg-muted">
                      {q.respuesta}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Otros destinos */}
        <section
          aria-labelledby="otros-destinos"
          className="border-t border-border bg-surface-2"
        >
          <div className="mx-auto max-w-content px-4 py-16 md:px-6 lg:px-8 lg:py-24">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="otros-destinos" className="font-display text-h2 text-fg">
                Otros destinos
              </h2>
              <Link
                href="/#destinos"
                className="rounded-sm text-[15px] font-medium text-accent underline decoration-1 underline-offset-[3px] hover:text-accent-hover"
              >
                Ver todos los destinos
              </Link>
            </div>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {otros.map((d) => {
                const f = getFicha(d.slug)
                return (
                  <li key={d.slug}>
                    <Link
                      href={`/viaje/${d.slug}`}
                      className="group block rounded-card transition-transform duration-(--dur-base) ease-papel hover:-translate-y-0.5"
                    >
                      <Postal
                        como="div"
                        semilla={d.slug}
                        {...(f ? { escena: f.escena } : {})}
                        proporcion="4:3"
                        kicker={d.pais}
                        titulo={d.nombre}
                        tituloClassName="text-[22px]"
                      >
                        {formatDias(d.diasRecomendados)} · Mejor época:{' '}
                        {d.mejorEpoca}
                      </Postal>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
