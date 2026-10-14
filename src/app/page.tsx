import type { Metadata } from 'next'
import { Intro } from '@/components/brand/intro/Intro'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import {
  AsiSeVe,
  BandaFinal,
  ComoFunciona,
  Destinos,
  Portada,
  ViajaEnGrupo,
} from '@/components/planner/landing/Secciones'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

/**
 * Landing (docs/DISENO.md §6.1). Server Component con islas cliente pequeñas
 * (caja de deseo, menú del header y modal de video). La intro «La ruta llega»
 * es CSS servido en el SSR y va antes del header; el hero queda pintado
 * debajo (data-wy-hero, .wy-hero-item con --i 0..4).
 *
 * /?destino=x y /?restaurar=1 redirigen a /planificar desde next.config.ts
 * (307 antes de renderizar), así esta página no lee searchParams y es estática.
 */
export default function HomePage() {
  return (
    <>
      <Intro />
      <SiteHeader />
      <main id="contenido" className="flex-1">
        <Portada />
        <ComoFunciona />
        <AsiSeVe />
        <Destinos />
        <ViajaEnGrupo />
        <BandaFinal />
      </main>
      <SiteFooter />
    </>
  )
}
