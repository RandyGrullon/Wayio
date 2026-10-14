import { useCallback } from 'react'
import { useToast } from '@/components/ui/Toast'
import type { ActionResult } from '@/types/admin'
import { AVISO_DEMO, usePanel } from './PanelContext'

export interface OpcionesAccion {
  /** Toast de éxito («Rol actualizado»). Sin él, no se avisa. */
  exito?: string
  /** Título del toast de error («No se pudo cambiar el rol»). */
  error: string
}

/**
 * Ejecuta una server action del panel con el mismo trato en todas partes:
 * en la vista de ejemplo no se llama, los fallos (devueltos o lanzados) se
 * avisan con un toast y nunca rompen la pantalla. Devuelve si salió bien.
 */
export function useAccion() {
  const { demo } = usePanel()
  const { toast, success, error } = useToast()

  return useCallback(
    async (
      accion: () => Promise<ActionResult>,
      opciones: OpcionesAccion
    ): Promise<boolean> => {
      if (demo) {
        toast({ ...AVISO_DEMO })
        return false
      }
      try {
        const res = await accion()
        if (res.ok) {
          if (opciones.exito) success(opciones.exito)
          return true
        }
        error(opciones.error, { description: res.error })
        return false
      } catch {
        error(opciones.error, {
          description: 'Revisa tu conexión e inténtalo de nuevo.',
        })
        return false
      }
    },
    [demo, toast, success, error]
  )
}
