import { cn } from '@/lib/utils/cn'

const ANCHO = 120
const ALTO = 32
const MARGEN = 3

/**
 * Sparkline de 32 px (docs/DISENO.md §5.13): trazo de 1,5 px en accent y el
 * último punto en primary. Decorativo: el valor y el delta van en texto.
 */
export function Sparkline({
  valores,
  className,
}: {
  valores: readonly number[]
  className?: string
}) {
  if (valores.length < 2) return null
  const max = Math.max(...valores)
  const min = Math.min(...valores)
  const rango = max - min || 1
  const paso = (ANCHO - MARGEN * 2) / (valores.length - 1)
  const puntos = valores.map((v, i) => {
    const x = MARGEN + i * paso
    const y = ALTO - MARGEN - ((v - min) / rango) * (ALTO - MARGEN * 2)
    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as const
  })
  const ultimo = puntos[puntos.length - 1]
  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      width={ANCHO}
      height={ALTO}
      aria-hidden="true"
      focusable="false"
      className={cn('h-8 w-[120px] shrink-0 overflow-visible', className)}
    >
      <polyline
        points={puntos.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent"
      />
      {ultimo ? (
        <circle
          cx={ultimo[0]}
          cy={ultimo[1]}
          r={2.75}
          fill="currentColor"
          className="text-primary"
        />
      ) : null}
    </svg>
  )
}
