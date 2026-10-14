'use client'

import type { ReactNode } from 'react'
import { CalendarDays, Ellipsis, Map as MapIcon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type ItemBarra = 'hoy' | 'mapa' | 'dias' | 'mas'

interface BarraInferiorProps {
  activo: ItemBarra
  onElegir: (item: ItemBarra) => void
}

const ITEMS: Array<{ id: ItemBarra; label: string; icono: ReactNode }> = [
  { id: 'hoy', label: 'Hoy', icono: <Sun /> },
  { id: 'mapa', label: 'Mapa', icono: <MapIcon /> },
  { id: 'dias', label: 'Días', icono: <CalendarDays /> },
  { id: 'mas', label: 'Más', icono: <Ellipsis /> },
]

/**
 * Barra inferior del viaje en móvil (docs/DISENO.md §6.6): Hoy, Mapa, Días y
 * Más. Activo = tinta con indicador superior de 2 px (seleccionado = tinta).
 * «Mapa» abre el mapa a pantalla completa (sin sheet arrastrable encima).
 */
export function BarraInferior({ activo, onElegir }: BarraInferiorProps) {
  return (
    <nav
      aria-label="Secciones del viaje"
      data-print="hide"
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-bottombar grid-cols-4">
        {ITEMS.map((item) => {
          const sel = item.id === activo
          return (
            <li key={item.id} className="relative">
              <button
                type="button"
                aria-current={sel ? 'page' : undefined}
                onClick={() => onElegir(item.id)}
                className={cn(
                  'flex h-full w-full flex-col items-center justify-center gap-1 text-[12px] font-semibold focus-visible:outline-offset-[-4px]',
                  '[&_svg]:size-[22px] [&_svg]:stroke-[1.75]',
                  sel ? 'text-fg' : 'text-fg-muted hover:text-fg'
                )}
              >
                {sel ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-fg"
                  />
                ) : null}
                <span aria-hidden="true" className="inline-flex">
                  {item.icono}
                </span>
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
