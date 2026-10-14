'use client'

import { X } from 'lucide-react'
import type { Conflict, ConflictSeverity } from '@/types/conflicts'
import { Callout } from '@/components/ui/Callout'
import type { CalloutTone } from '@/components/ui/Callout'
import { IconButton } from '@/components/ui/Button'

interface ConflictDisplayProps {
  conflicts: Conflict[]
  onDismiss?: (conflictId: string) => void
  className?: string
}

const TONO: Record<ConflictSeverity, CalloutTone> = {
  critico: 'danger',
  advertencia: 'warning',
  sugerencia: 'info',
  info: 'info',
}

const ETIQUETA: Record<ConflictSeverity, string> = {
  critico: 'Importante',
  advertencia: 'Aviso',
  sugerencia: 'Sugerencia',
  info: 'Información',
}

const ORDEN: ConflictSeverity[] = [
  'critico',
  'advertencia',
  'sugerencia',
  'info',
]

/**
 * Conflictos del horario como Callouts por severidad (docs/DISENO.md §6.6).
 * Sin botones de solución mientras el contrato no los soporte. La severidad
 * va también en texto (no solo en el color).
 */
export function ConflictDisplay({
  conflicts,
  onDismiss,
  className,
}: ConflictDisplayProps) {
  if (conflicts.length === 0) return null
  const ordenados = [...conflicts].sort(
    (a, b) => ORDEN.indexOf(a.severidad) - ORDEN.indexOf(b.severidad)
  )
  return (
    <ul className={className ?? 'flex flex-col gap-3'}>
      {ordenados.map((c) => {
        const afectadas = c.actividadesAfectadas
          .map((a) => a.nombre)
          .filter(Boolean)
        return (
          <li key={c.id} className="relative">
            <Callout
              tone={TONO[c.severidad]}
              role="status"
              className={onDismiss ? 'pr-14' : undefined}
              title={
                <>
                  <span className="sr-only">{ETIQUETA[c.severidad]}: </span>
                  {c.titulo}
                </>
              }
            >
              <p>{c.descripcion}</p>
              {afectadas.length > 0 ? (
                <p className="mt-1 opacity-90">
                  Afecta a: {afectadas.join(', ')}
                </p>
              ) : null}
            </Callout>
            {onDismiss ? (
              <IconButton
                label={`Ocultar el aviso «${c.titulo}»`}
                size="icon-sm"
                className="absolute top-2.5 right-2.5"
                onClick={() => onDismiss(c.id)}
              >
                <X />
              </IconButton>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
