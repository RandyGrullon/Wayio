import type { HTMLAttributes, ReactNode } from 'react'
import { Map as MapIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Skeleton (docs/DISENO.md §5.9): bg-surface-2 con barrido de --shimmer
 * (animate-shimmer). Con movimiento reducido queda estático.
 */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-shimmer rounded-[inherit] bg-surface-2 bg-[linear-gradient(90deg,var(--surface-2)_0%,var(--shimmer)_50%,var(--surface-2)_100%)] bg-[length:200%_100%]',
        className
      )}
      {...props}
    />
  )
}

/** Líneas de texto (h-[0.7em]); la última más corta. */
export function SkeletonText({
  lines = 2,
  className,
}: {
  lines?: number
  className?: string
}) {
  const anchos = ['w-full', 'w-11/12', 'w-4/5', 'w-2/3', 'w-3/5']
  return (
    <div
      aria-hidden="true"
      className={cn('flex flex-col gap-[0.55em]', className)}
    >
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-[0.7em] rounded-[4px]',
            i === lines - 1 && lines > 1 ? 'w-3/5' : anchos[i % anchos.length]
          )}
        />
      ))}
    </div>
  )
}

/**
 * Región de carga accesible: anuncia «Cargando…» una vez y oculta los
 * skeletons a los lectores de pantalla.
 */
export function SkeletonRegion({
  label = 'Cargando…',
  children,
  className,
}: {
  label?: string
  children: ReactNode
  className?: string
}) {
  return (
    // Sin aria-busy: en una región viva haría que el lector esperase y nunca
    // anunciara «Cargando…».
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

// ─── Plantillas ───────────────────────────────────────────────────────────

/** Portada de viaje/página: kicker, H1, lead y meta. */
export function SkeletonPortada({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex flex-col gap-4', className)}>
      <Skeleton className="h-3 w-40 rounded-[4px]" />
      <Skeleton className="h-10 w-4/5 rounded-[6px] md:h-14" />
      <Skeleton className="h-10 w-3/5 rounded-[6px] md:h-14" />
      <SkeletonText lines={2} className="mt-2 max-w-[60ch] text-lead" />
      <div className="mt-2 flex gap-3">
        <Skeleton className="h-control-md w-40 rounded-full" />
        <Skeleton className="h-control-md w-28 rounded-full" />
      </div>
    </div>
  )
}

/** Timeline de un día: columna de hora de 64 + dos líneas y un badge. */
export function SkeletonTimeline({
  filas = 3,
  className,
}: {
  filas?: number
  className?: string
}) {
  return (
    <div aria-hidden="true" className={cn('flex flex-col', className)}>
      {Array.from({ length: filas }, (_, i) => (
        <div
          key={i}
          className="flex gap-4 border-b border-border py-5 last:border-b-0"
        >
          <div className="flex w-16 shrink-0 flex-col gap-1.5">
            <Skeleton className="h-4 w-12 rounded-[4px]" />
            <Skeleton className="h-3 w-8 rounded-[4px]" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-1/2 rounded-[4px]" />
              <Skeleton className="h-6 w-16 rounded-stamp" />
            </div>
            <SkeletonText lines={2} className="text-body-s" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Tarjeta de versión (Básico / Confort / Premium). */
export function SkeletonVersion({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex flex-col gap-4 rounded-card border border-border bg-surface p-5 md:p-6',
        className
      )}
    >
      <Skeleton className="h-3 w-24 rounded-[4px]" />
      <Skeleton className="h-10 w-36 rounded-[6px]" />
      <Skeleton className="h-3 w-44 rounded-[4px]" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <SkeletonText lines={4} className="text-body-s" />
      <Skeleton className="mt-2 h-control-md w-full rounded-full" />
    </div>
  )
}

/** Fila de tabla del admin. */
export function SkeletonFilaTabla({
  columnas = 4,
  className,
}: {
  columnas?: number
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex h-[52px] items-center gap-4 border-t border-border px-4',
        className
      )}
    >
      {Array.from({ length: columnas }, (_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3 rounded-[4px]', i === 0 ? 'w-1/4' : 'flex-1')}
        />
      ))}
    </div>
  )
}

/** Stat card del admin. */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex flex-col gap-3 rounded-card border border-border bg-surface p-5',
        className
      )}
    >
      <Skeleton className="h-3 w-20 rounded-[4px]" />
      <Skeleton className="h-7 w-28 rounded-[6px]" />
      <Skeleton className="h-3 w-24 rounded-[4px]" />
    </div>
  )
}

/** Mapa: superficie con retícula, icono Map de 24 y «Cargando mapa…». */
export function SkeletonMapa({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        'reticula grid h-full min-h-60 place-items-center rounded-card bg-surface-2',
        className
      )}
    >
      <div className="flex flex-col items-center gap-2 text-fg-muted">
        <MapIcon aria-hidden="true" strokeWidth={1.75} className="size-6" />
        <span className="text-caption">Cargando mapa…</span>
      </div>
    </div>
  )
}
