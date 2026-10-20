import type { Metadata } from 'next'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { ComparativaPlanes } from '@/components/paywall/ComparativaPlanes'
import { PricingCards } from '@/components/paywall/PricingCards'
import { TEXTO_CUPO_GRATIS as CUPOS } from '@/components/trip/limitesIA'
import { DIAS_PASE, NOTA_USO_JUSTO } from '@/constants/planes'
import { PLANS } from '@/constants/pricing'
import { getBaseUrl } from '@/lib/utils/baseUrl'
import { formatCurrency } from '@/lib/utils/formatters'

const PRECIO_PASE = formatCurrency(PLANS.pro_por_viaje.precio, 'USD', {
  decimales: true,
})

export const metadata: Metadata = {
  title: 'Planes y precios',
  description: `Wayio es gratis con tu cuenta: ${CUPOS} al mes, con modo sin conexión, PDF e historial. Con Pro la IA no tiene límite; mensual, anual o un pase de ${DIAS_PASE} días.`,
  alternates: { canonical: `${getBaseUrl()}/precios` },
}

const PREGUNTAS = [
  {
    p: '¿Necesito pagar o crear una cuenta?',
    r: `Pagar, no. Necesitas una cuenta, que es gratis: con ella tienes ${CUPOS} al mes, además del mapa, el modo sin conexión, el PDF y el historial de tus viajes.`,
  },
  {
    p: '¿Qué pasa si se me acaba el cupo del mes?',
    r: 'No pierdes nada: tus viajes siguen guardados y puedes verlos sin conexión, compartirlos y editarlos a mano. Lo que se pausa es la IA hasta que el cupo se renueve el día 1 de cada mes a la medianoche (hora de República Dominicana), o hasta que pases a Pro.',
  },
  {
    p: '¿«Otra versión» cuenta como un viaje?',
    r: 'Sí. «Otra versión» le pide a la IA un viaje completo nuevo, así que cuenta como uno de tus viajes del mes. Si la IA falla y no te entrega el viaje, no se descuenta; los itinerarios de ejemplo tampoco cuentan.',
  },
  {
    p: `¿Cómo funciona el Pase Pro de ${DIAS_PASE} días?`,
    r: `Es un pago único de ${PRECIO_PASE} que activa Pro en toda tu cuenta durante ${DIAS_PASE} días desde el pago, para todos tus viajes. No es una suscripción: al terminar vuelves a Gratis y no se te cobra nada más.`,
  },
  {
    p: '¿Qué quiere decir «sin límite»?',
    r: NOTA_USO_JUSTO.replace(/^\*/, ''),
  },
  {
    p: '¿Puedo cancelar cuando quiera?',
    r: 'Sí. Pro mensual y Pro anual se gestionan desde Tu cuenta, en el portal de pagos: ahí cambias de plan, actualizas la tarjeta o cancelas. Si cancelas, sigues con Pro hasta el final del periodo que ya pagaste.',
  },
  {
    p: '¿Quién procesa los pagos?',
    r: 'Un procesador de pagos seguro, especializado en tarjetas. Wayio no ve ni guarda los datos de tu tarjeta.',
  },
] as const

type Params = Record<string, string | string[] | undefined>

/**
 * Planes y precios (MON-05) desde el catálogo público (src/constants/planes):
 * tarjetas, comparativa Gratis vs Pro y preguntas frecuentes. /planes
 * redirige aquí (next.config.ts). ?cancelado=1 al volver del pago sin pagar.
 */
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
            <p className="kicker kicker-filete">Planes y precios</p>
            <h1 className="mt-4 max-w-[18ch] font-display text-display-l text-fg">
              Planifica gratis. Viaja con <em className="italic">Pro</em>.
            </h1>
            <p className="mt-5 max-w-[60ch] text-lead text-fg-muted">
              Con tu cuenta gratis tienes {CUPOS} al mes. Pro quita los límites
              de la IA y suma las alertas y el reagendar con IA.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="precios-planes"
          className="mx-auto max-w-content px-4 pb-16 md:px-6 lg:px-8"
        >
          <h2 id="precios-planes" className="sr-only">
            Elige tu plan
          </h2>
          <PricingCards cancelado={cancelado} />
        </section>

        <section
          id="comparativa"
          aria-labelledby="precios-comparativa"
          className="scroll-mt-24 border-t border-border"
        >
          <div className="mx-auto max-w-[880px] px-4 py-16 md:px-6 md:py-20">
            <h2
              id="precios-comparativa"
              className="font-display text-h2 text-fg"
            >
              Gratis y Pro, lado a lado
            </h2>
            <p className="mt-3 max-w-[60ch] text-body-s text-fg-muted">
              Solo lo que Wayio hace de verdad. Los cupos de Gratis se renuevan
              el día 1 de cada mes.
            </p>
            <ComparativaPlanes className="mt-8" />
          </div>
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
