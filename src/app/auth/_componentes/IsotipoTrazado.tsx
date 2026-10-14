import { useId } from 'react'
import { ISOTIPO } from '@/components/brand/marks'
import { cn } from '@/lib/utils/cn'
import './auth.css'

/**
 * Isotipo de Wayio que se traza una sola vez (panel izquierdo del login,
 * docs/DISENO.md §6.9). Misma geometría que el Logo (marks.ts): el aro de
 * origen queda hueco con una máscara y el punto de destino va en primary.
 * Decorativo (aria-hidden). Server Component: la animación es CSS.
 */
export function IsotipoTrazado({ className }: { className?: string }) {
  const maskId = `wy-auth-iso-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const { ring, dot } = ISOTIPO
  return (
    <svg
      viewBox={ISOTIPO.viewBox}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn('wy-auth-iso size-14 text-fg', className)}
    >
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="64"
          height="64"
        >
          <rect width="64" height="64" fill="#fff" />
          <circle cx={ring.cx} cy={ring.cy} r={ring.hole} fill="#000" />
        </mask>
      </defs>
      <g
        mask={`url(#${maskId})`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          className="wy-auth-ruta"
          d={ISOTIPO.route}
          strokeWidth={ISOTIPO.stroke}
          pathLength={1}
        />
        <circle
          className="wy-auth-aro"
          cx={ring.cx}
          cy={ring.cy}
          r={ring.r}
          strokeWidth={ring.stroke}
        />
      </g>
      <circle
        className="wy-auth-punto"
        cx={dot.cx}
        cy={dot.cy}
        r={dot.r}
        style={{ fill: 'var(--primary, #C21A66)' }}
      />
    </svg>
  )
}
