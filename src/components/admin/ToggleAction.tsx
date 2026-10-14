'use client'

import { useOptimistic, useTransition } from 'react'
import { Switch } from '@/components/ui/Switch'
import type { ActionResult } from '@/types/admin'
import { useAccion } from './useAccion'

/**
 * Switch que aplica una server action (docs/DISENO.md §5.13): cambia al
 * instante con useOptimistic y vuelve atrás con un toast si falla.
 */
export function ToggleAction({
  enabled,
  action,
  label,
  exitoActivar,
  exitoDesactivar,
  error,
}: {
  enabled: boolean
  action: (enabled: boolean) => Promise<ActionResult>
  /** Nombre accesible: «Activar la función analisis_video». */
  label: string
  exitoActivar: string
  exitoDesactivar: string
  error: string
}) {
  const ejecutar = useAccion()
  const [optimista, setOptimista] = useOptimistic(enabled)
  const [pendiente, start] = useTransition()

  return (
    <Switch
      checked={optimista}
      aria-label={label}
      aria-busy={pendiente || undefined}
      onCheckedChange={(valor) =>
        start(async () => {
          setOptimista(valor)
          await ejecutar(() => action(valor), {
            exito: valor ? exitoActivar : exitoDesactivar,
            error,
          })
        })
      }
    />
  )
}
