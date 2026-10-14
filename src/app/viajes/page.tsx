import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { ButtonLink } from '@/components/ui/Button'
import { ListaViajes } from './ListaViajes'

export const metadata: Metadata = {
  title: 'Mis viajes',
  robots: { index: false, follow: false },
}

type Params = Record<string, string | string[] | undefined>

/**
 * Mis viajes (docs/DISENO.md §6.11). La lista se carga en el cliente con
 * GET /api/trips (cookies de sesión); ?suscripcion=ok al volver de Stripe.
 */
export default async function ViajesPage({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  const params = await searchParams
  const suscripcionOk = params['suscripcion'] === 'ok'

  return (
    <>
      <SiteHeader cta={false} />
      <main id="contenido" className="flex-1">
        <div className="mx-auto max-w-content px-4 pt-10 pb-20 md:px-6 md:pt-14 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="kicker kicker-filete">Cuaderno de viajes</p>
              <h1 className="mt-3 font-display text-h1 text-fg">Mis viajes</h1>
            </div>
            <ButtonLink
              href="/planificar"
              variant="outline"
              size="md"
              iconEnd={<ArrowRight />}
            >
              Trazar un viaje nuevo
            </ButtonLink>
          </div>
          <div className="mt-8">
            <ListaViajes suscripcionOk={suscripcionOk} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
