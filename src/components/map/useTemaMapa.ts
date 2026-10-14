'use client'

import { useSyncExternalStore } from 'react'
import { THEME_EVENT } from '@/components/ui/ThemeToggle'
import type { TemaMapa } from '@/constants/mapColors'

/**
 * Tema efectivo del documento (html.dark) para el mapa (docs/DISENO.md §10.1).
 *
 * La clase `dark` de <html> es la fuente de verdad: la cambian el script del
 * <head>, el ThemeToggle y el sistema. Se vigila con un MutationObserver y,
 * además, con el evento 'wayio-theme-change' que emite el ThemeToggle.
 */

function suscribir(aviso: () => void): () => void {
  const observador = new MutationObserver(aviso)
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  window.addEventListener(THEME_EVENT, aviso)
  return () => {
    observador.disconnect()
    window.removeEventListener(THEME_EVENT, aviso)
  }
}

const leer = (): TemaMapa =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light'

const enServidor = (): TemaMapa => 'light'

export function useTemaMapa(): TemaMapa {
  return useSyncExternalStore(suscribir, leer, enServidor)
}

/** ¿El usuario pidió menos movimiento? (MapLibre usa jumpTo y duración 0). */
export function prefiereMenosMovimiento(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
