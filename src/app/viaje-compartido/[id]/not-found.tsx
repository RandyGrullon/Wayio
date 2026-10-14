import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { IlustracionRuta } from '@/components/brand/IlustracionRuta'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { ButtonLink } from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'Viaje no disponible',
  robots: { index: false, follow: false },
}

/**
 * Viaje compartido inexistente o que ya no es público (docs/DISENO.md §6.7):
 * «Este viaje ya no se comparte o el enlace está roto».
 */
export default function ViajeCompartidoNoEncontrado() {
  return (
    <>
      <SiteHeader variant="minimo" cta={false} />
      <main id="contenido" className="reticula flex-1">
        <div className="mx-auto max-w-[560px] px-4 pt-24 pb-24 md:px-6">
          <IlustracionRuta variante="pregunta" className="size-32 md:size-40" />
          <h1 className="mt-8 font-display text-display-l text-fg">
            Este viaje ya no se comparte
          </h1>
          <p className="mt-4 max-w-[46ch] text-lead text-fg-muted">
            O el enlace está roto. Pide a quien te lo envió que vuelva a
            compartirlo, o traza tu propio viaje.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink
              href="/planificar"
              variant="primary"
              size="lg"
              iconEnd={<ArrowRight />}
            >
              Planificar el mío
            </ButtonLink>
            <ButtonLink href="/" variant="outline" size="lg">
              Volver al inicio
            </ButtonLink>
          </div>
        </div>
      </main>
    </>
  )
}
