import type { CSSProperties, ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'
import { formatPorcentaje } from '@/lib/utils/formatters'
import { Sparkline } from './Sparkline'

export type StatTone = 'neutral' | 'success' | 'warning' | 'danger'

export interface StatDelta {
  /** Variación en % (12.4 = +12,4 %). */
  porcentaje: number
  /** Contra qué se compara: «vs. 7 días previos». */
  periodo: string
}

const TONO: Record<StatTone, string> = {
  neutral: 'text-fg',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

/**
 * El valor se ajusta al ancho real de la tarjeta (es un contenedor: 1cqi = 1 %
 * de su contenido) para que «US$184.32» o «18,406,220» nunca se salgan en las
 * rejillas estrechas (2 columnas a 375 px, 4–5 columnas junto al sidebar).
 * Unos 0,62 em por carácter con tnum; nunca baja de 18 px.
 */
function tamanoValor(
  value: ReactNode,
  principal: boolean
): CSSProperties | undefined {
  const texto =
    typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : null
  if (!texto) return undefined
  const maximo = principal ? 'var(--text-num-xl)' : 'var(--text-num-l)'
  const porAncho = (100 / (Math.max(texto.length, 4) * 0.62)).toFixed(2)
  return { fontSize: `min(${maximo}, max(1.125rem, ${porAncho}cqi))` }
}

/**
 * Tarjeta de KPI (docs/DISENO.md §5.13): kicker, valor tnum (la principal
 * ocupa 2 columnas con text-num-xl), caption, chip de delta con signo, flecha
 * y texto, y sparkline opcional. `tone` sustituye a la antigua prop `accent`.
 * La sparkline va a la derecha del valor solo si la tarjeta es ancha; si no,
 * debajo (nunca se monta sobre el número).
 */
export function StatCard({
  label,
  value,
  caption,
  delta,
  serie,
  tone = 'neutral',
  principal = false,
  className,
}: {
  label: string
  value: ReactNode
  caption?: ReactNode
  delta?: StatDelta | null | undefined
  serie?: readonly number[] | undefined
  tone?: StatTone
  principal?: boolean
  className?: string
}) {
  return (
    <Card
      className={cn(
        '@container flex min-w-0 flex-col p-5 md:p-5',
        principal && 'col-span-2',
        className
      )}
    >
      <p className="kicker">{label}</p>
      <div className="mt-2 flex flex-col gap-2 @[20rem]:flex-row @[20rem]:items-end @[20rem]:justify-between @[20rem]:gap-3">
        <p
          className={cn(
            'min-w-0 tnum',
            principal ? 'text-num-xl' : 'text-num-l',
            TONO[tone]
          )}
          style={tamanoValor(value, principal)}
        >
          {value}
        </p>
        {serie && serie.length > 1 ? (
          <Sparkline valores={serie} className="max-w-full @[20rem]:mb-1" />
        ) : null}
      </div>
      {delta ? (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <ChipDelta delta={delta} />
          <span className="text-caption text-fg-subtle">{delta.periodo}</span>
        </p>
      ) : null}
      {caption ? (
        <p
          className={cn('text-caption text-fg-muted', delta ? 'mt-1' : 'mt-2')}
        >
          {caption}
        </p>
      ) : null}
    </Card>
  )
}

function ChipDelta({ delta }: { delta: StatDelta }) {
  const sube = delta.porcentaje > 0.05
  const baja = delta.porcentaje < -0.05
  const Icono = sube ? ArrowUpRight : baja ? ArrowDownRight : Minus
  const signo = sube ? '+' : baja ? '−' : ''
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-stamp px-1.5 text-[12px] font-semibold tnum',
        sube && 'bg-success-bg text-success-fg',
        baja && 'bg-danger-bg text-danger-fg',
        !sube && !baja && 'bg-surface-2 text-fg-muted'
      )}
    >
      <Icono aria-hidden="true" strokeWidth={2} className="size-3.5" />
      {sube || baja ? (
        <span className="sr-only">{sube ? 'Sube ' : 'Baja '}</span>
      ) : null}
      {sube || baja
        ? `${signo}${formatPorcentaje(Math.abs(delta.porcentaje), 1)}`
        : 'Igual'}
    </span>
  )
}

/**
 * Variación en % de un periodo frente al anterior de igual largo. null si no
 * hay base para comparar (evita un «+∞ %»).
 */
export function variacion(actual: number, previo: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(previo) || previo <= 0) {
    return null
  }
  return ((actual - previo) / previo) * 100
}
