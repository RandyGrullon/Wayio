import { useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { SelloSvg } from './glifos'
import './brand.css'

/**
 * Sello decorativo (docs/DISENO.md §5.5 y §8.3). Solo para momentos de marca
 * y refuerzos, NUNCA como única señal: siempre `aria-hidden`, y su
 * información debe existir también como texto accesible.
 *
 * - forma 'circular' (por defecto): el sello de marca con el isotipo (o un
 *   «?» para el 404) y texto en el anillo. Mínimo 72 px; la textura de tinta
 *   solo a partir de 96 px.
 * - forma 'rect': estampa de texto («GUARDADO», «ELEGIDA»).
 *
 * Rotación fija entre −4° y −8° (por defecto −6°). `animar` lo estampa una
 * vez al montar (scale 1.3→1, 260 ms).
 */

export type SelloTono = 'rosa' | 'laton' | 'tinta' | 'actual'

const TONO: Record<SelloTono, string> = {
  rosa: 'text-primary-text',
  laton: 'text-brass-text',
  tinta: 'text-fg',
  actual: '',
}

interface SelloComun {
  tono?: SelloTono
  /** Grados; usar entre −4 y −8. */
  rotacion?: number
  /** Entrada «estampada» al montar (una sola vez). */
  animar?: boolean
  className?: string
}

export interface SelloCircularProps extends SelloComun {
  forma?: 'circular'
  /** Texto del anillo («CARTAGENA · COLOMBIA»). Por defecto el de marca. */
  texto?: string
  /** 'isotipo' (por defecto) o 'pregunta' («?» del 404). */
  centro?: 'isotipo' | 'pregunta'
  /** Desgaste de tinta. Por defecto activo; desactívalo por debajo de 96 px. */
  textura?: boolean
  children?: never
}

export interface SelloRectProps extends SelloComun {
  forma: 'rect'
  children: ReactNode
}

export type SelloProps = SelloCircularProps | SelloRectProps

export function Sello(props: SelloProps) {
  const id = `wy-sello-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const tono = props.tono ?? 'rosa'
  const rotacion = props.rotacion ?? -6
  const estilo: CSSProperties = { rotate: `${rotacion}deg` }

  if (props.forma === 'rect') {
    return (
      <span
        aria-hidden="true"
        style={estilo}
        className={cn(
          'inline-flex h-8 shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-stamp border-2 border-current px-3',
          'text-[12px] font-semibold uppercase leading-none tracking-[0.14em] [font-stretch:85%]',
          'outline outline-1 outline-offset-2 outline-current',
          TONO[tono],
          props.animar && 'wy-sello-in',
          props.className
        )}
      >
        {props.children}
      </span>
    )
  }

  return (
    <SelloSvg
      idBase={id}
      aria-hidden="true"
      focusable="false"
      style={estilo}
      className={cn(
        'size-24 shrink-0 select-none',
        TONO[tono],
        props.animar && 'wy-sello-in',
        props.className
      )}
      {...(props.texto !== undefined && { texto: props.texto })}
      {...(props.centro !== undefined && { centro: props.centro })}
      textura={props.textura ?? true}
    />
  )
}
