import {
  Skeleton,
  SkeletonPortada,
  SkeletonRegion,
  SkeletonTimeline,
} from '@/components/ui/Skeleton'

/**
 * Carga de ruta (docs/DISENO.md §6.13): skeleton de portada y timeline.
 * Nunca un spinner a pantalla completa.
 */
export default function Loading() {
  return (
    <SkeletonRegion label="Cargando…" className="flex-1">
      {/* Hueco del header (no se monta el real para no duplicarlo) */}
      <div aria-hidden="true" className="h-header-sm md:h-header" />
      <div className="mx-auto max-w-content px-4 pt-10 pb-16 md:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          <SkeletonPortada className="lg:col-span-7" />
          <Skeleton className="hidden aspect-[4/3] rounded-sheet lg:col-span-5 lg:block" />
        </div>
        <div className="mt-14 max-w-[720px]">
          <Skeleton className="h-3 w-32 rounded-[4px]" />
          <Skeleton className="mt-3 h-8 w-2/3 rounded-[6px]" />
          <SkeletonTimeline filas={3} className="mt-6" />
        </div>
      </div>
    </SkeletonRegion>
  )
}
