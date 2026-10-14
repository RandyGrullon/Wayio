/**
 * Estado compartido de la intro: si está en curso (el logo real de la
 * cabecera se oculta hasta el relevo) y quién es el destino del FLIP (el
 * wordmark de la cabecera de Home o de Auth, medido con measureInWindow).
 */
import { useSyncExternalStore } from 'react'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

type Medidor = () => Promise<Rect | null>

let activa = false
let medidor: Medidor | null = null
const oyentes = new Set<() => void>()

function avisar(): void {
  for (const cb of oyentes) cb()
}

export function introActiva(): boolean {
  return activa
}

export function setIntroActiva(valor: boolean): void {
  if (activa === valor) return
  activa = valor
  avisar()
}

function suscribir(cb: () => void): () => void {
  oyentes.add(cb)
  return () => {
    oyentes.delete(cb)
  }
}

/** true mientras la intro se está reproduciendo. */
export function useIntroActiva(): boolean {
  return useSyncExternalStore(suscribir, introActiva, introActiva)
}

/** El logo de la cabecera se registra como destino del relevo. */
export function registrarDestinoIntro(m: Medidor): () => void {
  medidor = m
  return () => {
    if (medidor === m) medidor = null
  }
}

/** Posición actual del logo destino en la ventana (null si no hay). */
export async function medirDestinoIntro(): Promise<Rect | null> {
  if (!medidor) return null
  try {
    return await medidor()
  } catch {
    return null
  }
}
