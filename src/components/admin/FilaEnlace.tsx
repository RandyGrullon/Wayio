'use client'

import type { MouseEvent, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

/** Lo interactivo de una celda conserva su propio clic. */
const INTERACTIVO =
  'a,button,input,select,textarea,summary,details,label,[role="menu"],[role="menuitem"],[role="switch"],[role="dialog"]'

/**
 * Fila de DataTable que lleva a `href` al pulsar en cualquier parte
 * (docs/DISENO.md §5.13). No usa un enlace estirado con `position: absolute`
 * sobre el <tr>: WebKit no trata las filas de tabla como bloque contenedor y
 * el enlace taparía la página entera. El acceso por teclado y lector de
 * pantalla es el enlace real de la última celda (ChevronRight).
 *
 * - Ignora los clics en controles de la celda (copiar, menú desplegado,
 *   switch…) y los que vienen de un portal (ConfirmDialog abierto desde la
 *   fila).
 * - Ctrl/⌘ + clic o clic central abren en otra pestaña, como un enlace.
 * - Si el usuario está seleccionando texto, no navega.
 */
export function FilaEnlace({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  const router = useRouter()

  const esClicDeFila = (e: MouseEvent<HTMLTableRowElement>): boolean => {
    if (e.defaultPrevented) return false
    const destino = e.target
    if (!(destino instanceof Element)) return false
    // Los portales (ConfirmDialog) propagan el evento por React aunque no
    // estén dentro del <tr> en el DOM.
    if (!e.currentTarget.contains(destino)) return false
    if (destino.closest(INTERACTIVO)) return false
    const seleccion = window.getSelection()
    return !(seleccion && seleccion.toString().length > 0)
  }

  const abrirAparte = () => {
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  return (
    <tr
      className={cn('cursor-pointer', className)}
      onClick={(e) => {
        if (e.button !== 0 || !esClicDeFila(e)) return
        if (e.metaKey || e.ctrlKey || e.shiftKey) abrirAparte()
        else router.push(href)
      }}
      onAuxClick={(e) => {
        if (e.button === 1 && esClicDeFila(e)) abrirAparte()
      }}
    >
      {children}
    </tr>
  )
}
