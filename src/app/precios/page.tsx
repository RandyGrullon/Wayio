import type { Metadata } from 'next'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { PricingCards } from '@/components/paywall/PricingCards'
import { getBaseUrl } from '@/lib/utils/baseUrl'

export const metadata: Metadata = {
  title: 'Planes y precios',
  description:
    'Planifica gratis con IA. Con Wayio Pro tienes modo sin conexión, alertas con IA y más; con Pro grupo, chat, gastos y ubicación para todo el grupo.',
  alternates: { canonical: `${getBaseUrl()}/precios` },
}

const PREGUNTAS = [
  {
    p: '¿Necesito pagar para planificar un viaje?',
    r: 'No. Puedes trazar tus viajes con IA, verlos en el mapa, guardarlos y compartirlos con el plan gratis.',
  },
  {
    p: '¿Puedo cancelar cuando quiera?',
    r: 'Sí. Las suscripciones se gestionan desde Tu cuenta, en el portal de pagos: ahí puedes cambiar de plan, actualizar tu tarjeta o cancelar.',
  },
  {
    p: '¿Qué es «Pro por viaje»?',
    r: 'Un pago único que activa las funciones Pro para un solo viaje, sin suscripción.',
  },
  {
    p: '¿Quién procesa los pagos?',
    r: 'Stripe, una plataforma de pagos con tarjeta. Wayio no ve ni guarda los datos de tu tarjeta.',
  },
] as const

type Params = Record<string, string | string[] | undefined>

/** Planes y precios (MON-05): ?cancelado=1 al volver de Stripe sin pagar. */
export default async function PreciosPage({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  const params = await searchParams
  const cancelado = params['cancelado'] === '1'

  return (
    <>
      <SiteHeader cta={false} />
      <main id="contenido" className="flex-1">
        <section className="reticula">
          <div className="mx-auto max-w-content px-4 pt-14 pb-12 md:px-6 lg:px-8 lg:pt-20">
            <p className="kicker kicker-filete">Planes</p>
            <h1 className="mt-4 max-w-[18ch] font-display text-display-l text-fg">
              Planifica gratis. Viaja con <em className="italic">Pro</em>.
            </h1>
            <p className="mt-5 max-w-[60ch] text-lead text-fg-muted">
              Trazar tu viaje con IA es gratis. Pro suma lo que ayuda durante el
              camino, y Pro grupo, lo que hace falta para viajar juntos.
            </p>
          </div>
        </section>

        <section
          aria-label="Planes"
          className="mx-auto max-w-content px-4 pb-16 md:px-6 lg:px-8"
        >
          <PricingCards cancelado={cancelado} />
        </section>

        <section
          aria-labelledby="precios-preguntas"
          className="border-t border-border bg-surface-2"
        >
          <div className="mx-auto max-w-prose px-4 py-16 md:px-6 md:py-20">
            <h2 id="precios-preguntas" className="font-display text-h2 text-fg">
              Preguntas frecuentes
            </h2>
            <dl className="mt-8 divide-y divide-border border-y border-border">
              {PREGUNTAS.map((q) => (
                <div key={q.p} className="py-5">
                  <dt className="text-title text-fg">{q.p}</dt>
                  <dd className="mt-2 text-body text-fg-muted">{q.r}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
