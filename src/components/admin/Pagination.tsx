import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buttonClasses } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { formatNumero } from '@/lib/utils/formatters'

/** Páginas a mostrar: 1 … 4 5 6 … 12 */
function paginasVisibles(actual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set([1, total, actual - 1, actual, actual + 1])
  const lista = [...set]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b)
  const out: (number | null)[] = []
  lista.forEach((p, i) => {
    const previa = lista[i - 1]
    if (previa !== undefined && p - previa > 1) out.push(null)
    out.push(p)
  })
  return out
}

/**
 * Pie de DataTable (docs/DISENO.md §5.13): «Mostrando 1–25 de 1,284» y
 * anterior / números / siguiente en h-control-sm. Enlaces normales: funciona
 * sin JS y conserva el resto de filtros (hrefPagina los incluye).
 */
export function Pagination({
  page,
  pageSize,
  total,
  hrefPagina,
}: {
  page: number
  pageSize: number
  total: number
  hrefPagina: (pagina: number) => string
}) {
  if (total === 0) return null
  const paginas = Math.max(1, Math.ceil(total / pageSize))
  const actual = Math.min(Math.max(1, page), paginas)
  const desde = (actual - 1) * pageSize + 1
  const hasta = Math.min(total, actual * pageSize)

  const flecha = buttonClasses({ variant: 'outline', size: 'sm' })

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-body-s text-fg-muted tnum">
        Mostrando {formatNumero(desde)}–{formatNumero(hasta)} de{' '}
        {formatNumero(total)}
      </p>
      {paginas > 1 ? (
        <nav aria-label="Paginación">
          <ul className="flex items-center gap-1">
            <li>
              {actual > 1 ? (
                <Link
                  href={hrefPagina(actual - 1)}
                  rel="prev"
                  className={flecha}
                >
                  <ChevronLeft aria-hidden="true" strokeWidth={1.75} />
                  <span className="max-sm:sr-only">Anterior</span>
                </Link>
              ) : (
                <span aria-disabled="true" className={cn(flecha, 'opacity-45')}>
                  <ChevronLeft aria-hidden="true" strokeWidth={1.75} />
                  <span className="max-sm:sr-only">Anterior</span>
                </span>
              )}
            </li>
            {paginasVisibles(actual, paginas).map((p, i) =>
              p === null ? (
                <li
                  key={`hueco-${i}`}
                  aria-hidden="true"
                  className="px-1 text-fg-subtle max-sm:hidden"
                >
                  …
                </li>
              ) : (
                <li key={p} className="max-sm:hidden">
                  <Link
                    href={hrefPagina(p)}
                    aria-current={p === actual ? 'page' : undefined}
                    aria-label={`Página ${p}`}
                    className={cn(
                      buttonClasses({
                        variant: p === actual ? 'tinta' : 'ghost',
                        size: 'icon-sm',
                      }),
                      'text-[14px] tnum'
                    )}
                  >
                    {p}
                  </Link>
                </li>
              )
            )}
            <li className="px-2 text-body-s text-fg-muted tnum sm:hidden">
              {actual} de {paginas}
            </li>
            <li>
              {actual < paginas ? (
                <Link
                  href={hrefPagina(actual + 1)}
                  rel="next"
                  className={flecha}
                >
                  <span className="max-sm:sr-only">Siguiente</span>
                  <ChevronRight aria-hidden="true" strokeWidth={1.75} />
                </Link>
              ) : (
                <span aria-disabled="true" className={cn(flecha, 'opacity-45')}>
                  <span className="max-sm:sr-only">Siguiente</span>
                  <ChevronRight aria-hidden="true" strokeWidth={1.75} />
                </span>
              )}
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  )
}
