import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/Card'

/**
 * Zona de peligro de las fichas (docs/DISENO.md §6.12): Card con borde
 * danger/40 y una fila por acción (título, consecuencia y botón
 * danger-outline que abre su ConfirmDialog).
 */
export function ZonaPeligro({
  descripcion,
  aviso,
  children,
}: {
  descripcion?: ReactNode
  /** Aviso sobre las filas (p. ej. «No puedes actuar sobre tu cuenta»). */
  aviso?: ReactNode
  children: ReactNode
}) {
  return (
    <Card
      as="section"
      aria-labelledby="zona-peligro"
      className="border-danger/40 p-0 md:p-0"
    >
      <div className="flex items-start gap-3 px-5 pt-5 md:px-6">
        <AlertTriangle
          aria-hidden="true"
          strokeWidth={1.75}
          className="mt-0.5 size-5 shrink-0 text-danger"
        />
        <div className="min-w-0">
          <h2 id="zona-peligro" className="text-title text-fg">
            Zona de peligro
          </h2>
          {descripcion ? (
            <p className="mt-0.5 text-body-s text-fg-muted">{descripcion}</p>
          ) : null}
        </div>
      </div>
      {aviso ? <div className="px-5 pt-4 md:px-6">{aviso}</div> : null}
      <div className="mt-4 divide-y divide-border border-t border-border">
        {children}
      </div>
    </Card>
  )
}

export function FilaPeligro({
  titulo,
  descripcion,
  children,
}: {
  titulo: string
  descripcion: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 md:px-6">
      <div className="min-w-0 max-w-[60ch]">
        <p className="text-[15px] font-semibold text-fg">{titulo}</p>
        <p className="mt-0.5 text-body-s text-fg-muted">{descripcion}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
