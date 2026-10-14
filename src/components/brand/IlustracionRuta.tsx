import { cn } from '@/lib/utils/cn'
import { ISOTIPO } from './marks'

/**
 * Ilustración de línea para estados vacíos y el 404 (docs/DISENO.md §5.10 y
 * §6.13): la ruta de la w punteada en `rule` (trazo de 2 px) que sale de un
 * aro (origen) y termina en un único acento:
 *
 * - variante 'punto' (por defecto): el destino, un punto en `primary`.
 * - variante 'pregunta': la ruta se corta y termina en un sello de latón
 *   «?» a −8° (404, búsqueda sin resultado, enlace roto).
 *
 * Decorativa (aria-hidden). 96 px por defecto; escala con `className`.
 */

export interface IlustracionRutaProps {
  variante?: 'punto' | 'pregunta'
  className?: string
}

// La ruta del isotipo (rejilla 64) escalada a 96 con un margen óptico.
const ESCALA = 1.5
const P = ISOTIPO.route.replace(/[ML]/g, ' ').trim().split(/\s+/).map(Number)
const PUNTOS: Array<[number, number]> = []
for (let i = 0; i + 1 < P.length; i += 2) {
  const x = P[i]
  const y = P[i + 1]
  if (x !== undefined && y !== undefined)
    PUNTOS.push([+(x * ESCALA - 1.5).toFixed(2), +(y * ESCALA - 2).toFixed(2)])
}
const d = (pts: Array<[number, number]>) =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')

const ORIGEN = PUNTOS[0] ?? [16.5, 38.5]
const R_ORIGEN = 5
// La ruta arranca en el borde del aro (el aro queda hueco sobre cualquier fondo).
const SALIDA = (() => {
  const b = PUNTOS[1]
  if (!b) return ORIGEN
  const dx = b[0] - ORIGEN[0]
  const dy = b[1] - ORIGEN[1]
  const l = Math.hypot(dx, dy) || 1
  const k = (R_ORIGEN + 3.5) / l
  return [
    +(ORIGEN[0] + dx * k).toFixed(2),
    +(ORIGEN[1] + dy * k).toFixed(2),
  ] as [number, number]
})()
const TRAMOS = [SALIDA, ...PUNTOS.slice(1)]
const RUTA_COMPLETA = d(TRAMOS)
// Variante «pregunta»: la ruta llega hasta el segundo valle y se corta.
const RUTA_CORTADA = d(TRAMOS.slice(0, 3))
const TRAMO_FINAL = (() => {
  const a = PUNTOS[2]
  const b = PUNTOS[3]
  if (!a || !b) return ''
  // Medio tramo más, tras un hueco: «se perdió la señal».
  const t0 = 0.38
  const t1 = 0.62
  const p = (t: number) =>
    `${+(a[0] + (b[0] - a[0]) * t).toFixed(2)} ${+(a[1] + (b[1] - a[1]) * t).toFixed(2)}`
  return `M${p(t0)} L${p(t1)}`
})()
const DESTINO = {
  cx: +(ISOTIPO.dot.cx * ESCALA - 1.5).toFixed(2),
  cy: +(ISOTIPO.dot.cy * ESCALA - 2).toFixed(2),
}

export function IlustracionRuta({
  variante = 'punto',
  className,
}: IlustracionRutaProps) {
  const ruta = variante === 'punto' ? RUTA_COMPLETA : RUTA_CORTADA
  return (
    <svg
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn('size-24 shrink-0 text-rule', className)}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Ruta punteada */}
        <path d={ruta} strokeDasharray="0.1 5.2" />
        {variante === 'pregunta' ? (
          <path d={TRAMO_FINAL} strokeDasharray="0.1 5.2" />
        ) : null}
        {/* Origen: aro hueco */}
        <circle cx={ORIGEN[0]} cy={ORIGEN[1]} r={R_ORIGEN} />
      </g>

      {variante === 'punto' ? (
        <circle
          cx={DESTINO.cx}
          cy={DESTINO.cy}
          r="7"
          style={{ fill: 'var(--primary, #C21A66)' }}
        />
      ) : (
        // Sello de latón «?» a −8°
        <g
          className="text-brass"
          transform={`rotate(-8 ${DESTINO.cx} ${DESTINO.cy + 4})`}
        >
          <circle
            cx={DESTINO.cx}
            cy={DESTINO.cy + 4}
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx={DESTINO.cx}
            cy={DESTINO.cy + 4}
            r="11.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
          />
          <text
            x={DESTINO.cx}
            y={DESTINO.cy + 5}
            textAnchor="middle"
            dominantBaseline="central"
            fill="currentColor"
            style={{
              font: 'italic 500 17px var(--font-display, Georgia, serif)',
            }}
          >
            ?
          </text>
        </g>
      )}
    </svg>
  )
}
