import { useId } from 'react'
import { cn } from '@/lib/utils/cn'
import { IsotipoGlifo, SelloSvg } from './glifos'
import { BRAND, ISOTIPO, WORDMARK, WORDMARK_PATHS } from './marks'
import './brand.css'

/**
 * Logo de Wayio (docs/DISENO.md §8). Server Component.
 *
 * - variant 'wordmark' (por defecto): «wayio» monolínea; la w es la ruta y el
 *   punto de la i es el destino.
 * - variant 'isotipo': la w que sale de un aro (origen) hacia un punto
 *   (destino). Nunca junto al wordmark.
 * - variant 'sello': sello circular de un color (estampa). Para sellos
 *   decorativos con rotación, texto propio o textura usa <Sello />.
 *
 * tone: 'color' (tinta + punto rosa, se adapta a claro/oscuro), 'inverso'
 * (papel + punto rosa claro, para fondos de tinta) o 'mono' (todo
 * currentColor).
 *
 * Decorativo por defecto (aria-hidden): envuélvelo en un Link con aria-label.
 * Pasa `title` si el logo debe anunciarse por sí mismo.
 */

export type LogoVariant = 'wordmark' | 'isotipo' | 'sello'
export type LogoTone = 'color' | 'inverso' | 'mono'

export interface LogoProps {
  variant?: LogoVariant
  tone?: LogoTone
  className?: string
  /** Texto accesible; si se omite el logo es decorativo. */
  title?: string
  /** Marca el logo del header como destino del relevo de la intro. */
  'data-wy-logo'?: boolean
  /** @deprecated alias antiguo: showText=false equivale a variant="isotipo". */
  showText?: boolean
}

const TONO: Record<LogoTone, { trazo: string; punto: string; sello: string }> =
  {
    color: {
      trazo: 'text-fg',
      punto: 'var(--wy-dot, var(--primary, #C21A66))',
      // §8.3: el sello es de un color, rosa-700 (y su equivalente en oscuro)
      sello: 'text-primary-text',
    },
    inverso: {
      trazo: 'text-[#F7F4EE]',
      punto: BRAND.rosaOscuro,
      sello: 'text-[#F7F4EE]',
    },
    mono: { trazo: '', punto: 'currentColor', sello: '' },
  }

export function Logo({
  variant,
  tone = 'color',
  className,
  title,
  showText,
  ...rest
}: LogoProps) {
  const v: LogoVariant =
    variant ?? (showText === false ? 'isotipo' : 'wordmark')
  const id = `wy-logo-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const a11y = title
    ? ({ role: 'img', 'aria-label': title } as const)
    : ({ 'aria-hidden': true, focusable: false } as const)
  const dataAttr = rest['data-wy-logo'] ? { 'data-wy-logo': '' } : {}
  const { trazo, punto, sello } = TONO[tone]

  if (v === 'wordmark') {
    return (
      <svg
        viewBox={WORDMARK.viewBox}
        xmlns="http://www.w3.org/2000/svg"
        className={cn('h-[30px] w-auto overflow-visible', trazo, className)}
        {...a11y}
        {...dataAttr}
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={WORDMARK.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {WORDMARK_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        {/* El punto salta en el hover del enlace y al guardar (brand.css) */}
        <circle
          className="wy-logo-punto"
          cx={WORDMARK.dot.cx}
          cy={WORDMARK.dot.cy}
          r={WORDMARK.dot.r}
          fill={punto}
        />
      </svg>
    )
  }

  if (v === 'isotipo') {
    return (
      <svg
        viewBox={ISOTIPO.viewBox}
        xmlns="http://www.w3.org/2000/svg"
        className={cn('h-8 w-8', trazo, className)}
        {...a11y}
        {...dataAttr}
      >
        <IsotipoGlifo maskId={`${id}-hueco`} punto={punto} />
      </svg>
    )
  }

  // Sello circular de un color (currentColor; se rota al usarlo como estampa).
  return (
    <SelloSvg
      idBase={id}
      className={cn('h-24 w-24', sello, className)}
      {...a11y}
      {...dataAttr}
    />
  )
}
