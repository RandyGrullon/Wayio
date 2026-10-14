'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

/** Alto máximo previsto de un menú de fila (3 opciones y un separador). */
const ALTO_MENU = 180
const SEPARACION = 8

/**
 * Clases para el panel de <Menu>: lo saca del flujo con position: fixed
 * anclado al botón (variables que pone useMenuFijo en el contenedor). Así no
 * lo recortan la Card (overflow-hidden) ni el scroll horizontal de la tabla,
 * que hacían ilegible el menú de las últimas filas.
 */
export const CLASE_MENU_FIJO =
  'fixed! top-(--menu-fila-top)! bottom-(--menu-fila-bottom)! right-(--menu-fila-right)! left-auto! mt-0!'

function botonDe(raiz: HTMLElement | null): HTMLElement | null {
  return raiz?.querySelector<HTMLElement>('[aria-haspopup="menu"]') ?? null
}

/**
 * Coloca el menú de una fila junto a su botón: debajo si cabe y, si no,
 * encima. Se mide al pulsar el botón (puntero o teclado) y se recoloca con el
 * scroll o al cambiar el tamaño mientras está abierto.
 */
export function useMenuFijo() {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [estilo, setEstilo] = useState<CSSProperties>({})

  const colocar = useCallback(() => {
    const boton = botonDe(ref.current)
    if (!boton) return
    const r = boton.getBoundingClientRect()
    const alto = window.innerHeight
    const debajo = alto - r.bottom
    const arriba = debajo < ALTO_MENU + SEPARACION && r.top > debajo
    setEstilo({
      '--menu-fila-top': arriba ? 'auto' : `${r.bottom + SEPARACION}px`,
      '--menu-fila-bottom': arriba ? `${alto - r.top + SEPARACION}px` : 'auto',
      '--menu-fila-right': `${Math.max(SEPARACION, document.documentElement.clientWidth - r.right)}px`,
    } as CSSProperties)
  }, [])

  useEffect(() => {
    const alMover = () => {
      if (botonDe(ref.current)?.getAttribute('aria-expanded') === 'true') {
        colocar()
      }
    }
    window.addEventListener('scroll', alMover, { capture: true, passive: true })
    window.addEventListener('resize', alMover)
    return () => {
      window.removeEventListener('scroll', alMover, { capture: true })
      window.removeEventListener('resize', alMover)
    }
  }, [colocar])

  /** Props del contenedor (span) que envuelve al <Menu>. */
  return {
    ref,
    style: estilo,
    onPointerDownCapture: colocar,
    onKeyDownCapture: colocar,
  }
}
