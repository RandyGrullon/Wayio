import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { IlustracionRuta } from '@/components/brand/IlustracionRuta'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { ButtonLink } from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'Esta página no está en el mapa',
}

/**
 * 404 de marca (docs/DISENO.md §6.13): una w de ruta punteada que se corta y
 * termina en un sello de latón «?» a −8°, y el chiste de «Isla Nula».
 */
export default function NotFound() {
  return (
    <>
      <SiteHeader cta={false} />
      <main id="contenido" className="reticula flex-1">
        <div className="mx-auto max-w-[560px] px-4 pt-24 pb-24 md:px-6">
          <IlustracionRuta variante="pregunta" className="size-32 md:size-40" />
          <p className="mt-8 font-mono text-[12px] tracking-[0.04em] text-fg-subtle">
            ERROR 404 · 0.0000° N · 0.0000° E · ISLA NULA
          </p>
          <h1 className="mt-3 font-display text-display-l text-fg">
            Esta página no está en el <em className="italic">mapa</em>
          </h1>
          <p className="mt-4 max-w-[46ch] text-lead text-fg-muted">
            Puede que el enlace esté roto o que el viaje ya no se comparta.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink
              href="/"
              variant="primary"
              size="lg"
              iconEnd={<ArrowRight />}
            >
              Volver al inicio
            </ButtonLink>
            <ButtonLink href="/#destinos" variant="outline" size="lg">
              Explorar destinos
            </ButtonLink>
          </div>
        </div>
      </main>
    </>
  )
}
