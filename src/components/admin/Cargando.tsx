import {
  Skeleton,
  SkeletonFilaTabla,
  SkeletonRegion,
  SkeletonStat,
  SkeletonText,
} from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'

/**
 * Plantillas de carga del panel (loading.tsx de cada sección): skeletons con
 * la forma real de la pantalla, nunca un spinner a pantalla completa.
 */

function CabeceraEsqueleto() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2.5">
      <Skeleton className="h-8 w-48 rounded-[6px]" />
      <Skeleton className="h-3.5 w-72 max-w-full rounded-[4px]" />
    </div>
  )
}

function TablaEsqueleto({ columnas = 5 }: { columnas?: number }) {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-card border border-border bg-surface"
    >
      <div className="flex h-12 items-center border-b border-border px-4">
        <Skeleton className="h-3 w-28 rounded-[4px]" />
      </div>
      <div className="h-10 bg-surface-2" />
      {Array.from({ length: 8 }, (_, i) => (
        <SkeletonFilaTabla
          key={i}
          columnas={columnas}
          className={cn(i === 0 && 'border-t-0')}
        />
      ))}
    </div>
  )
}

export function CargandoLista({
  stats = 0,
  columnas = 5,
  filtros = true,
  etiqueta = 'Cargando la lista…',
}: {
  stats?: number
  columnas?: number
  filtros?: boolean
  etiqueta?: string
}) {
  return (
    <SkeletonRegion label={etiqueta} className="space-y-6">
      <CabeceraEsqueleto />
      {stats > 0 ? (
        <div
          aria-hidden="true"
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          {Array.from({ length: stats }, (_, i) => (
            <SkeletonStat key={i} />
          ))}
        </div>
      ) : null}
      {filtros ? (
        <div aria-hidden="true" className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-control-md w-full rounded-control sm:w-80" />
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
      ) : null}
      <TablaEsqueleto columnas={columnas} />
    </SkeletonRegion>
  )
}

export function CargandoPanel() {
  return (
    <SkeletonRegion label="Cargando el panel…" className="space-y-6">
      <CabeceraEsqueleto />
      <div aria-hidden="true" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SkeletonStat className="col-span-2" />
        <SkeletonStat />
        <SkeletonStat />
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>
      <div aria-hidden="true" className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5"
          >
            <Skeleton className="h-4 w-40 rounded-[4px]" />
            <Skeleton className="h-44 w-full rounded-[6px]" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  )
}

export function CargandoDetalle() {
  return (
    <SkeletonRegion label="Cargando la ficha…" className="space-y-6">
      <div aria-hidden="true" className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24 rounded-[4px]" />
        <Skeleton className="h-8 w-64 max-w-full rounded-[6px]" />
        <Skeleton className="h-3.5 w-52 rounded-[4px]" />
      </div>
      <div
        aria-hidden="true"
        className="flex gap-6 border-b border-border pb-3"
      >
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-4 w-20 rounded-[4px]" />
        ))}
      </div>
      <div aria-hidden="true" className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5"
          >
            <Skeleton className="h-4 w-32 rounded-[4px]" />
            <SkeletonText lines={4} className="text-body-s" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  )
}

export function CargandoTarjetas({
  etiqueta = 'Cargando…',
}: {
  etiqueta?: string
}) {
  return (
    <SkeletonRegion label={etiqueta} className="space-y-6">
      <CabeceraEsqueleto />
      <div aria-hidden="true" className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5"
          >
            <Skeleton className="h-4 w-44 rounded-[4px]" />
            <SkeletonText lines={2} className="text-body-s" />
            <Skeleton className="h-control-sm w-32 rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  )
}
