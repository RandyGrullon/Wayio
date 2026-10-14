import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatNumero } from '@/lib/utils/formatters'

export interface OpcionFiltro {
  valor: string
  label: string
  /** Conteo del filtro (si el backend lo da). */
  count?: number | undefined
}

/**
 * Chips de filtro del admin (docs/DISENO.md §5.3): h-9, seleccionado = tinta
 * con Check, contador en un badge tnum. Son enlaces: conservan el resto de
 * searchParams y reinician la página (hrefDe lo resuelve).
 */
export function FiltrosChips({
  etiqueta,
  opciones,
  activo,
  hrefDe,
  className,
}: {
  etiqueta: string
  opciones: readonly OpcionFiltro[]
  activo: string
  hrefDe: (valor: string) => string
  className?: string
}) {
  return (
    <nav aria-label={etiqueta} className={className}>
      <ul className="flex flex-wrap gap-2">
        {opciones.map((o) => {
          const sel = o.valor === activo
          return (
            <li key={o.valor}>
              <Link
                href={hrefDe(o.valor)}
                scroll={false}
                aria-current={sel ? 'true' : undefined}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[14px] font-medium',
                  'transition-colors duration-(--dur-fast) ease-papel [&_svg]:size-4 [&_svg]:stroke-[2]',
                  sel
                    ? 'border-surface-inverse bg-surface-inverse text-fg-inverse'
                    : 'border-border-strong bg-surface text-fg hover:bg-surface-2'
                )}
              >
                {sel ? <Check aria-hidden="true" /> : null}
                {o.label}
                {o.count !== undefined ? (
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-stamp px-1.5 text-[12px] font-semibold tnum',
                      sel
                        ? 'bg-fg-inverse/15 text-fg-inverse'
                        : 'bg-surface-2 text-fg-muted'
                    )}
                  >
                    {formatNumero(o.count)}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
