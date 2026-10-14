import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { VistaViaje } from './_componentes/VistaViaje'
import { EsqueletoViaje } from './_componentes/EsqueletoViaje'

/**
 * /trip/[id] — viaje guardado y en vivo (docs/DISENO.md §6.6).
 *
 * El HTML no lleva datos del usuario: es una shell que el service worker puede
 * guardar. El viaje llega en el cliente (/api/trips/[id] o la copia offline de
 * IndexedDB) dentro de un Suspense, porque la vista lee ?reserva=ok|cancelada.
 */

export const metadata: Metadata = {
  title: 'Tu viaje',
  robots: { index: false, follow: false },
}

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Suspense
      fallback={
        <>
          <SiteHeader variant="app" />
          <main id="contenido" className="flex-1">
            <EsqueletoViaje />
          </main>
        </>
      }
    >
      <VistaViaje tripId={id} />
    </Suspense>
  )
}
