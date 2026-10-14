'use client'

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

/**
 * Contexto del panel para los componentes cliente: quién es el admin (para
 * no actuar sobre la propia cuenta) y si es la vista de ejemplo (las
 * acciones no se ejecutan).
 */
export interface PanelInfo {
  userId: string
  email: string
  demo: boolean
}

const Contexto = createContext<PanelInfo>({
  userId: '',
  email: '',
  demo: false,
})

export function PanelProvider({
  value,
  children,
}: {
  value: PanelInfo
  children: ReactNode
}) {
  return <Contexto.Provider value={value}>{children}</Contexto.Provider>
}

export function usePanel(): PanelInfo {
  return useContext(Contexto)
}

/** Texto del aviso cuando se intenta actuar en la vista de ejemplo. */
export const AVISO_DEMO = {
  message: 'Vista de ejemplo',
  description: 'No hay base de datos conectada: no se guardó ningún cambio.',
} as const
