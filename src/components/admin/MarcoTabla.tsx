'use client'

import { useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { Rows3 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const CLAVE = 'wayio-admin-densidad'
const EVENTO = 'wayio-admin-densidad'

/** Respaldo en memoria si el almacenamiento está bloqueado. */
let enMemoria: boolean | null = null

function leer(): boolean {
  if (enMemoria !== null) return enMemoria
  try {
    return localStorage.getItem(CLAVE) === 'compacta'
  } catch {
    return false
  }
}

function suscribir(cb: () => void) {
  window.addEventListener(EVENTO, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENTO, cb)
    window.removeEventListener('storage', cb)
  }
}

const enServidor = () => false

/**
 * Marco cliente de DataTable: barra superior (contador, filtros) y el toggle
 * de densidad (filas de 52 o 40 px). La preferencia se recuerda en este
 * navegador (localStorage, con try/catch) y se aplica con
 * data-densidad sobre `group/tabla`.
 */
export function MarcoTabla({
  cabecera,
  densidad = true,
  children,
}: {
  cabecera?: ReactNode
  densidad?: boolean
  children: ReactNode
}) {
  const compacta = useSyncExternalStore(suscribir, leer, enServidor)

  const alternar = () => {
    enMemoria = !compacta
    try {
      localStorage.setItem(CLAVE, enMemoria ? 'compacta' : 'normal')
    } catch {
      // Almacenamiento bloqueado: vale para esta visita.
    }
    window.dispatchEvent(new Event(EVENTO))
  }

  return (
    <div
      className="group/tabla"
      data-densidad={compacta ? 'compacta' : 'normal'}
    >
      {cabecera || densidad ? (
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-1.5">
          <div className="min-w-0 text-body-s text-fg-muted">{cabecera}</div>
          {densidad ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<Rows3 strokeWidth={1.75} />}
              aria-pressed={compacta}
              onClick={alternar}
              className="text-fg-muted hover:text-fg max-md:hidden"
            >
              Filas compactas
            </Button>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}
