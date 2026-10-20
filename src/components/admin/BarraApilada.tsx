import { cn } from '@/lib/utils/cn'
import { formatNumero, formatPorcentaje } from '@/lib/utils/formatters'

export interface SegmentoBarra {
  clave: string
  label: string
  valor: number
}

/** mar · rosa · latón (§5.13); en oscuro, sus variantes claras. */
const COLORES = [
  'bg-mar-600 dark:bg-mar-300',
  'bg-rosa-600 dark:bg-rosa-400',
  'bg-laton-600 dark:bg-laton-300',
] as const

/**
 * Barra apilada al 100 % con leyenda, valores y % (docs/DISENO.md §5.13).
 * Los segmentos van separados 2 px y la leyenda repite cada dato en texto:
 * el color nunca es la única señal.
 */
export function BarraApilada({
  segmentos,
  unidad,
  formato = formatNumero,
  className,
}: {
  segmentos: readonly SegmentoBarra[]
  /** «viajes» (para el texto accesible). */
  unidad: string
  /** Formato de cada valor (por defecto «1,284»; p. ej. usd para dinero). */
  formato?: (valor: number) => string
  className?: string
}) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0)
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0)
  const resumen = segmentos
    .map(
      (s) =>
        `${s.label}: ${formato(s.valor)} (${formatPorcentaje(pct(s.valor))})`
    )
    .join(', ')

  return (
    <div className={className}>
      {total > 0 ? (
        <div
          role="img"
          aria-label={`${formato(total)} ${unidad}. ${resumen}.`}
          className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
        >
          {segmentos.map((s, i) =>
            s.valor > 0 ? (
              <span
                key={s.clave}
                className={cn(
                  'h-full first:rounded-l-full last:rounded-r-full',
                  COLORES[i % COLORES.length]
                )}
                style={{ width: `${pct(s.valor)}%` }}
              />
            ) : null
          )}
        </div>
      ) : (
        <div
          className="h-3 w-full rounded-full bg-surface-2"
          aria-hidden="true"
        />
      )}
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {segmentos.map((s, i) => (
          <li key={s.clave} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                'mt-1.5 size-2.5 shrink-0 rounded-full',
                COLORES[i % COLORES.length]
              )}
            />
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-fg">
                {s.label}
              </span>
              <span className="block text-caption text-fg-muted tnum">
                {formato(s.valor)} · {formatPorcentaje(pct(s.valor))}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
