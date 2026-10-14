'use client'

import { useMemo, useSyncExternalStore } from 'react'

/**
 * Reloj de la pantalla en vivo: se actualiza cada 30 s (sin pedir nada al
 * servidor). En el servidor y en la hidratación devuelve null: el contenido
 * que depende de la hora se pinta ya en el cliente.
 */
const PASO_MS = 30_000

function suscribir(aviso: () => void): () => void {
  const id = window.setInterval(aviso, PASO_MS)
  const alVolver = () => {
    if (document.visibilityState === 'visible') aviso()
  }
  document.addEventListener('visibilitychange', alVolver)
  return () => {
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', alVolver)
  }
}

const tic = () => Math.floor(Date.now() / PASO_MS)
const ticServidor = () => 0

export function useAhora(): Date | null {
  const t = useSyncExternalStore(suscribir, tic, ticServidor)
  return useMemo(() => (t === 0 ? null : new Date(t * PASO_MS)), [t])
}
