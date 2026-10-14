'use client'

import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Table2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { formatFecha, formatNumero } from '@/lib/utils/formatters'
import { usd, usdPreciso } from './etiquetas'

export interface PuntoSerie {
  /** 'YYYY-MM-DD' */
  date: string
  value: number
}

type Formato = 'numero' | 'usd'

function escala(max: number, formato: Formato): number[] {
  if (max <= 0) return [0, 1, 2, 3]
  const bruto = max / 3
  const pot = 10 ** Math.floor(Math.log10(bruto))
  const n = bruto / pot
  let paso = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pot
  if (formato === 'numero') paso = Math.max(1, Math.ceil(paso))
  return [0, 1, 2, 3].map((k) => Number((k * paso).toFixed(4)))
}

/**
 * Gráfico de barras del panel (docs/DISENO.md §5.13): barras en accent con
 * radio superior de 2 px, eje Y con 4 marcas, eje X «12 nov» cada 7 días
 * (cada 2 en una semana, cada 30 en 90 días) y rejilla de 1 px. Cada barra es un botón con aria-label y tooltip de tinta
 * (hover y foco; flechas para recorrerlas). «Ver como tabla» muestra la serie.
 */
export function BarChart({
  data,
  titulo,
  unidad,
  formato = 'numero',
  className,
}: {
  data: readonly PuntoSerie[]
  /** Nombre accesible del gráfico («Registros por día»). */
  titulo: string
  /** Unidad para el texto accesible («registros»). Ignorada con usd. */
  unidad?: { uno: string; varios: string }
  formato?: Formato
  className?: string
}) {
  const id = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const [activo, setActivo] = useState<number | null>(null)
  const [foco, setFoco] = useState<number | null>(null)
  const [tabla, setTabla] = useState(false)

  const n = data.length
  // Una fecha del eje X cada `paso` días, contando desde hoy: cada 7 hasta un
  // mes; en series cortas (7 días), cada 2; en 90 días, una por mes, para que
  // las etiquetas no se monten en móvil.
  const paso = n <= 10 ? 2 : n <= 31 ? 7 : 30
  // Con muchas barras (90 días) el hueco se reduce a 1 px o no se verían.
  const hueco = n > 45 ? 'gap-px' : 'gap-0.5 sm:gap-1'
  const max = Math.max(0, ...data.map((d) => d.value))
  const ticks = escala(max, formato)
  const tope = ticks[ticks.length - 1] || 1
  const tabulable = foco ?? n - 1

  const valorTexto = (v: number) =>
    formato === 'usd'
      ? usdPreciso(v)
      : unidad
        ? `${formatNumero(v)} ${v === 1 ? unidad.uno : unidad.varios}`
        : formatNumero(v)
  const tickTexto = (v: number) =>
    formato === 'usd' ? usd(v) : formatNumero(v)
  const fechaTexto = (d: string) => formatFecha(d, { diaSemana: false })

  const mover = (desde: number, e: KeyboardEvent<HTMLButtonElement>) => {
    const destinos: Record<string, number> = {
      ArrowRight: Math.min(n - 1, desde + 1),
      ArrowLeft: Math.max(0, desde - 1),
      Home: 0,
      End: n - 1,
    }
    if (e.key === 'Escape') {
      setActivo(null)
      return
    }
    const destino = destinos[e.key]
    if (destino === undefined) return
    e.preventDefault()
    setFoco(destino)
    refs.current[destino]?.focus()
  }

  if (n === 0) {
    return (
      <p
        className={cn('py-10 text-center text-body-s text-fg-muted', className)}
      >
        Aún no hay datos en este periodo.
      </p>
    )
  }

  return (
    <div className={className}>
      <div className="relative h-44">
        {/* Rejilla y eje Y */}
        {ticks.map((t) => (
          <div
            key={t}
            aria-hidden="true"
            className="absolute right-0 left-14 border-t border-border"
            style={{ bottom: `${(t / tope) * 100}%` }}
          >
            <span className="absolute top-0 -left-14 w-12 -translate-y-1/2 text-right text-caption text-fg-subtle tnum">
              {tickTexto(t)}
            </span>
          </div>
        ))}

        {/* Barras */}
        <div
          role="group"
          aria-label={titulo}
          className={cn(
            'absolute inset-y-0 right-0 left-14 flex items-end',
            hueco
          )}
        >
          {data.map((d, i) => {
            const alto = (d.value / tope) * 100
            const etiqueta = `${fechaTexto(d.date)}: ${valorTexto(d.value)}`
            const borde =
              i < 2
                ? 'left-0'
                : i > n - 3
                  ? 'right-0'
                  : 'left-1/2 -translate-x-1/2'
            return (
              <button
                key={d.date}
                ref={(el) => {
                  refs.current[i] = el
                }}
                type="button"
                aria-label={etiqueta}
                tabIndex={i === tabulable ? 0 : -1}
                onMouseEnter={() => setActivo(i)}
                onMouseLeave={() => setActivo(null)}
                onFocus={() => {
                  setActivo(i)
                  setFoco(i)
                }}
                onBlur={() => setActivo(null)}
                onKeyDown={(e) => mover(i, e)}
                className="group relative flex h-full min-w-0 flex-1 items-end rounded-[2px] focus-visible:outline-offset-1"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'block w-full rounded-t-[2px] bg-accent transition-opacity duration-(--dur-fast)',
                    activo !== null && activo !== i && 'opacity-55'
                  )}
                  style={{
                    height: `${alto}%`,
                    minHeight: d.value > 0 ? 2 : 0,
                  }}
                />
                {activo === i ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'pointer-events-none absolute z-(--z-tooltip) w-max rounded-control bg-surface-inverse px-2.5 py-1.5 text-[13px] leading-snug font-medium whitespace-nowrap text-fg-inverse shadow-elev tnum',
                      borde
                    )}
                    style={{ bottom: `calc(${alto}% + 8px)` }}
                  >
                    {etiqueta}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {/* Eje X: una fecha cada `paso` días, contando desde hoy */}
      <div aria-hidden="true" className={cn('mt-2 ml-14 flex', hueco)}>
        {data.map((d, i) => (
          <span key={d.date} className="relative h-4 min-w-0 flex-1">
            {(n - 1 - i) % paso === 0 ? (
              <span
                className={cn(
                  'absolute top-0 text-caption whitespace-nowrap text-fg-subtle',
                  i === n - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                )}
              >
                {fechaTexto(d.date)}
              </span>
            ) : null}
          </span>
        ))}
      </div>

      <div className="mt-4">
        <Button
          variant="link"
          size="sm"
          icon={<Table2 />}
          aria-expanded={tabla}
          aria-controls={`${id}-tabla`}
          onClick={() => setTabla((v) => !v)}
        >
          {tabla ? 'Ocultar tabla' : 'Ver como tabla'}
        </Button>
        {tabla ? (
          <div
            id={`${id}-tabla`}
            className="mt-3 max-h-64 overflow-y-auto rounded-control border border-border"
          >
            <table className="w-full text-[14px]">
              <caption className="sr-only">{titulo}</caption>
              <thead className="sticky top-0 bg-surface-2 text-[12px] font-semibold tracking-[0.06em] text-fg-muted uppercase">
                <tr>
                  <th scope="col" className="h-9 px-3 text-left">
                    Fecha
                  </th>
                  <th scope="col" className="h-9 px-3 text-right">
                    {formato === 'usd' ? 'Importe' : 'Cantidad'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.date} className="border-t border-border">
                    <td className="h-9 px-3 text-fg">
                      {formatFecha(d.date, { anio: true })}
                    </td>
                    <td className="h-9 px-3 text-right text-fg tnum">
                      {formato === 'usd'
                        ? usdPreciso(d.value)
                        : formatNumero(d.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}
