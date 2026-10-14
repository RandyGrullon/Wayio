import type { ReactNode } from 'react'
import { CloudOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { IlustracionRuta } from '@/components/brand/IlustracionRuta'
import { cn } from '@/lib/utils/cn'

export type EmptyIlustracion = 'ruta' | 'sello' | 'error' | 'ninguna'

export interface EmptyStateProps {
  title: string
  description?: ReactNode
  /** UNA sola acción (Button o ButtonLink). */
  action?: ReactNode
  /** ruta (punto rosa), sello «?» de latón, error (CloudOff) o ninguna. */
  illustration?: EmptyIlustracion
  /** Icono lucide propio dentro de un aro (sustituye a la ilustración). */
  icon?: LucideIcon
  headingLevel?: 'h1' | 'h2' | 'h3'
  className?: string
}

/**
 * Estado vacío (docs/DISENO.md §5.10): ilustración de línea de 96 px
 * (src/components/brand/IlustracionRuta), título font-display text-h3, texto
 * text-body-s y una sola acción. El error es distinto del vacío:
 * illustration="error" («No pudimos cargar esto» + «Reintentar»).
 */
export function EmptyState({
  title,
  description,
  action,
  illustration = 'ruta',
  icon,
  headingLevel = 'h2',
  className,
}: EmptyStateProps) {
  const Titulo = headingLevel
  return (
    <div className={cn('mx-auto max-w-[360px] py-12 text-center', className)}>
      <div className="mx-auto mb-5 flex size-24 items-center justify-center">
        {icon ? (
          <IconoEnAro Icono={icon} />
        ) : illustration === 'error' ? (
          <IconoEnAro Icono={CloudOff} />
        ) : illustration === 'ninguna' ? null : (
          <IlustracionRuta
            variante={illustration === 'sello' ? 'pregunta' : 'punto'}
          />
        )}
      </div>
      <Titulo className="font-display text-h3 text-fg">{title}</Titulo>
      {description ? (
        <div className="mx-auto mt-2 max-w-[40ch] text-body-s text-fg-muted">
          {description}
        </div>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  )
}

/** Icono lucide dentro de un aro punteado en --rule (96 px). */
function IconoEnAro({ Icono }: { Icono: LucideIcon }) {
  return (
    <span className="relative grid size-24 place-items-center text-rule">
      <svg
        viewBox="0 0 96 96"
        aria-hidden="true"
        className="absolute inset-0 size-full"
        fill="none"
      >
        <circle
          cx="48"
          cy="48"
          r="40"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="0.1 6"
        />
      </svg>
      <Icono
        aria-hidden="true"
        strokeWidth={1.75}
        className="size-9 text-fg-muted"
      />
    </span>
  )
}
