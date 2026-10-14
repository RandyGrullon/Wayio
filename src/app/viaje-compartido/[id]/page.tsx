import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowRight, CalendarDays, Users } from 'lucide-react'
import { Postal } from '@/components/brand/Postal'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { TripMap } from '@/components/map/TripMap'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { DayChapter } from '@/components/trip/DayChapter'
import { AntesDeIr, NotasDeRuta } from '@/components/trip/TripNotes'
import {
  PAQUETE_LABEL,
  contarActividades,
  coordenadasDelViaje,
  monedaDelViaje,
} from '@/components/trip/tripUtils'
import {
  formatCoordenadas,
  formatCurrency,
  formatDias,
  formatNumero,
  formatRangoFechas,
  formatViajeros,
} from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { CopiarAMisViajes } from './_componentes/CopiarAMisViajes'
import { obtenerCompartido } from './_lib/compartido'

/**
 * /viaje-compartido/[id] — vista pública de solo lectura (docs/DISENO.md
 * §6.7). Server Component: lee la versión pública con la misma lógica que
 * GET /api/shared/[id]. Nunca se indexa (robots noindex). La imagen OG por
 * viaje está en opengraph-image.tsx.
 */

type Props = { params: Promise<{ id: string }> }

const NO_INDEX = { index: false, follow: false } as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const r = await obtenerCompartido(id)
  if (r.estado !== 'ok') {
    return { title: 'Viaje compartido', robots: NO_INDEX }
  }
  const dias = r.trip.dias.length
  const titulo = `${r.destino} · Plan compartido`
  const descripcion = `Itinerario de ${formatDias(dias)} por ${r.destino} (${formatRangoFechas(r.fechaInicio, r.fechaFin)}), trazado con Wayio.`
  return {
    title: titulo,
    description: descripcion,
    robots: NO_INDEX,
    openGraph: { title: titulo, description: descripcion, type: 'article' },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: descripcion,
    },
  }
}

export default async function SharedTripPage({ params }: Props) {
  const { id } = await params
  const r = await obtenerCompartido(id)
  if (r.estado === 'no_encontrado') notFound()

  const header = (
    <SiteHeader
      variant="minimo"
      soloLectura
      cta={{ label: 'Crear el mío', href: '/planificar' }}
    />
  )

  if (r.estado === 'no_disponible') {
    return (
      <>
        {header}
        <main id="contenido" className="reticula flex-1">
          <div className="mx-auto max-w-content px-4 md:px-6 lg:px-8">
            <EmptyState
              headingLevel="h1"
              illustration="error"
              title="La vista compartida no está disponible ahora"
              description="Estamos teniendo problemas para mostrar este viaje. Vuelve a intentarlo en unos minutos."
              action={
                <ButtonLink href="/planificar" variant="outline">
                  Planificar el mío
                </ButtonLink>
              }
              className="pt-24"
            />
          </div>
        </main>
      </>
    )
  }

  const { trip, destino, fechaInicio, fechaFin } = r
  const moneda = monedaDelViaje(trip)
  const coords = coordenadasDelViaje(trip)
  const actividades = contarActividades(trip)
  const esCrucero = trip.dias.some((d) =>
    d.actividades.some((a) => a.puertoCrucero)
  )
  // Solo lo que necesitan los capítulos (no se serializa el viaje entero en
  // cada uno).
  const datosCapitulo = { fechaInicio, destino, id: trip.id }

  return (
    <>
      {header}
      <main id="contenido" className="flex-1">
        <div className="mx-auto w-full max-w-content px-4 pt-8 pb-20 md:px-6 md:pt-12 lg:px-8">
          {/* Portada */}
          <header className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-8">
            <div className="min-w-0 lg:col-span-7">
              <p className="kicker kicker-filete">
                Un plan compartido · {PAQUETE_LABEL[trip.paquete] ?? 'Confort'}
              </p>
              <h1 className="mt-4 font-display text-display-l text-fg">
                <em className="italic">{destino}</em>
              </h1>
              <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-body-s text-fg-muted">
                <li className="inline-flex items-center gap-2">
                  <CalendarDays
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-[18px] text-fg-subtle"
                  />
                  {formatRangoFechas(fechaInicio, fechaFin)}
                </li>
                <li className="inline-flex items-center gap-2">
                  <Users
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-[18px] text-fg-subtle"
                  />
                  {formatViajeros(trip.personas)}
                </li>
                {coords ? (
                  <li className="font-mono text-data text-fg-subtle">
                    <span className="sr-only">Coordenadas: </span>
                    {formatCoordenadas(coords.lat, coords.lng)}
                  </li>
                ) : null}
              </ul>
              {trip.resumenViaje ? (
                <p className="mt-5 max-w-[60ch] text-lead text-fg-muted">
                  {trip.resumenViaje}
                </p>
              ) : null}
              <div className="mt-7 md:hidden" data-print="hide">
                <ButtonLink
                  href="/planificar"
                  variant="primary"
                  size="lg"
                  fullWidth
                  iconEnd={<ArrowRight />}
                >
                  Crear el mío
                </ButtonLink>
              </div>
            </div>
            <div className="lg:col-span-5" data-print="hide">
              <Postal
                semilla={destino}
                proporcion="4:3"
                sello={destino}
                selloTono="laton"
                como="div"
                arteClassName="max-h-[320px]"
              />
            </div>
          </header>

          {/* Franja de datos */}
          <dl className="mt-12 grid grid-cols-2 border-y border-border md:grid-cols-4">
            {[
              { etiqueta: 'Días', valor: formatNumero(trip.dias.length) },
              { etiqueta: 'Viajeros', valor: formatNumero(trip.personas) },
              { etiqueta: 'Actividades', valor: formatNumero(actividades) },
              {
                etiqueta: 'Gasto en destino',
                valor: formatCurrency(trip.presupuestoTotal, moneda),
              },
            ].map((c, i) => (
              <div
                key={c.etiqueta}
                className={cn(
                  'min-w-0 px-4 py-5 md:px-6',
                  i % 2 === 0 && 'border-r border-border',
                  i < 2 && 'border-b border-border md:border-b-0',
                  i === 1 && 'md:border-r',
                  i === 0 && 'pl-0',
                  i === 2 && 'pl-0 md:pl-6'
                )}
              >
                <dt className="kicker">{c.etiqueta}</dt>
                <dd className="mt-2 text-[24px] leading-tight font-semibold text-fg tnum">
                  {c.valor}
                </dd>
              </div>
            ))}
          </dl>

          {/* Cuerpo: días de solo lectura + mapa */}
          <div className="mt-10 grid gap-8 lg:grid-cols-12 xl:gap-10">
            <aside
              aria-label="Mapa del viaje"
              className="lg:order-2 lg:col-span-5"
              data-print="hide"
            >
              <div className="h-[40dvh] min-h-60 lg:sticky lg:top-20 lg:h-[calc(100dvh-104px)]">
                <TripMap
                  dias={trip.dias}
                  moneda={moneda}
                  isCrucero={esCrucero}
                  etiqueta={`Mapa de ${destino}`}
                  className="h-full w-full shadow-card"
                />
              </div>
            </aside>
            <div className="min-w-0 lg:order-1 lg:col-span-7">
              <AntesDeIr advertencias={trip.advertencias} />
              <div className="mt-8 flex flex-col gap-14">
                {trip.dias.map((dia, i) => (
                  <DayChapter
                    key={`${dia.numero}-${i}`}
                    dia={dia}
                    indice={i}
                    trip={datosCapitulo}
                    moneda={moneda}
                    modo="lectura"
                  />
                ))}
              </div>
              <NotasDeRuta consejos={trip.consejos} className="mt-14" />
            </div>
          </div>
        </div>

        {/* Banda: hazlo tuyo */}
        <section
          aria-labelledby="hazlo-tuyo"
          className="bg-primary text-primary-fg"
          data-print="hide"
        >
          <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between md:px-6 md:py-16 lg:px-8">
            <div>
              <h2 id="hazlo-tuyo" className="font-display text-h2">
                ¿Te gusta este plan? Hazlo tuyo
              </h2>
              <p className="mt-2 max-w-[52ch] text-body-s">
                Cópialo a tus viajes para editarlo, o traza el tuyo desde cero
                con tus fechas y tu presupuesto.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <CopiarAMisViajes trip={trip} compartidoId={id} />
              <ButtonLink
                href="/planificar"
                variant="outline"
                size="lg"
                iconEnd={<ArrowRight />}
                className="border-primary-fg text-primary-fg hover:bg-primary-fg/10 focus-visible:outline-primary-fg"
              >
                Planificar el mío
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
