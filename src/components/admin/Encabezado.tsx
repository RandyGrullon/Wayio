import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Cabecera de página del panel: h1 Newsreader de 28 px (§6.12), descripción
 * y acciones a la derecha.
 */
export function Encabezado({
  titulo,
  descripcion,
  acciones,
  className,
}: {
  titulo: ReactNode
  descripcion?: ReactNode
  acciones?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-x-6 gap-y-4',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance text-fg">
          {titulo}
        </h1>
        {descripcion ? (
          <p className="mt-1.5 max-w-[60ch] text-body-s text-fg-muted">
            {descripcion}
          </p>
        ) : null}
      </div>
      {acciones ? (
        <div className="flex flex-wrap items-center gap-2">{acciones}</div>
      ) : null}
    </div>
  )
}

/** Título de bloque dentro de una página (sans, no compite con el h1). */
export function TituloBloque({
  children,
  acciones,
  id,
  className,
}: {
  children: ReactNode
  acciones?: ReactNode
  id?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        className
      )}
    >
      <h2 id={id} className="text-title text-fg">
        {children}
      </h2>
      {acciones}
    </div>
  )
}
