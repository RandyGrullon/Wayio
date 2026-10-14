import {
  SkeletonMapa,
  SkeletonPortada,
  SkeletonRegion,
  SkeletonTimeline,
} from '@/components/ui/Skeleton'

/** Carga del viaje: portada y timeline (nunca un spinner a pantalla completa). */
export function EsqueletoViaje() {
  return (
    <SkeletonRegion label="Cargando tu viaje…">
      <div className="mx-auto w-full max-w-content px-4 pt-8 pb-16 md:px-6 md:pt-12 lg:px-8">
        <SkeletonPortada className="max-w-3xl" />
        <div className="mt-10 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SkeletonTimeline filas={4} />
          </div>
          <div className="hidden lg:col-span-5 lg:block">
            <SkeletonMapa className="h-[60dvh]" />
          </div>
        </div>
      </div>
    </SkeletonRegion>
  )
}
