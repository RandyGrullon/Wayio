import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge con la escala propia de globals.css (docs/DISENO.md §2.1).
 * Sin esto, `text-label` se tomaría por un color y `cn('text-label text-fg')`
 * borraría el tamaño; igual con h-control-*, rounded-card, shadow-elev, etc.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'display-xl',
        'display-l',
        'h1',
        'h2',
        'h3',
        'title',
        'lead',
        'body',
        'body-s',
        'label',
        'caption',
        'overline',
        'data',
        'num-xl',
        'num-l',
      ],
      shadow: ['card', 'elev', 'float', 'soft'],
      radius: ['stamp', 'control', 'card', 'sheet'],
      spacing: [
        'control-sm',
        'control-md',
        'control-lg',
        'control-xl',
        'header',
        'header-sm',
        'bottombar',
        'sidebar',
      ],
      container: ['content', 'prose', 'form', 'admin'],
      blur: ['header'],
      ease: ['papel', 'salida', 'tinta', 'sello', 'portal', 'out-soft'],
      animate: ['shimmer', 'hormigas', 'sello', 'ping-gps', 'rise'],
      breakpoint: ['xs'],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
