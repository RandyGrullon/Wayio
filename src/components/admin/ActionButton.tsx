'use client'

import { useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import type { ButtonSize, ButtonVariant } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
import type { ActionResult } from '@/types/admin'
import { usePanel } from './PanelContext'
import { useAccion } from './useAccion'

/** Confirmación (sustituye a window.confirm, docs/DISENO.md §5.6). */
export interface ConfirmacionAccion {
  /** En forma de pregunta: «¿Eliminar este viaje?». */
  titulo: string
  /** Consecuencia: «Se borran también su chat y sus gastos.» */
  descripcion?: string
  /** Verbo exacto del botón: «Eliminar viaje». */
  confirmar: string
  /** Gerundio mientras corre: «Eliminando…». */
  cargando?: string
  /** danger (por defecto) o neutral (tinta). */
  tono?: 'danger' | 'neutral'
  /** Texto que hay que escribir (email o nombre) en lo irreversible. */
  escribir?: string
}

/**
 * Botón que ejecuta una server action del panel, con ConfirmDialog opcional,
 * toast del resultado y redirección tras el éxito (p. ej. al eliminar).
 */
export function ActionButton({
  action,
  label,
  icon,
  variant = 'outline',
  size = 'sm',
  confirm,
  exito,
  error,
  redirigirA,
  disabled = false,
  className,
}: {
  action: () => Promise<ActionResult>
  label: string
  icon?: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  confirm?: ConfirmacionAccion
  /** Toast de éxito («Viaje eliminado»). */
  exito?: string
  /** Título del toast de error («No se pudo eliminar el viaje»). */
  error: string
  redirigirA?: string
  disabled?: boolean
  className?: string
}) {
  const router = useRouter()
  const { demo } = usePanel()
  const ejecutar = useAccion()
  const [abierto, setAbierto] = useState(false)
  const [pendiente, start] = useTransition()

  const correr = async (): Promise<boolean> => {
    const ok = await ejecutar(action, {
      error,
      ...(exito ? { exito } : {}),
    })
    // Cada action revalida la vista desde la que se usa: la respuesta ya
    // trae la pantalla al día; solo hace falta navegar si se pide.
    if (ok && redirigirA) router.push(redirigirA)
    return ok
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        icon={icon}
        loading={pendiente}
        disabled={disabled}
        className={className}
        onClick={() => {
          if (confirm) setAbierto(true)
          else
            start(async () => {
              await correr()
            })
        }}
      >
        {label}
      </Button>
      {confirm ? (
        <ConfirmDialog
          open={abierto}
          onClose={() => setAbierto(false)}
          title={confirm.titulo}
          description={confirm.descripcion}
          confirmLabel={confirm.confirmar}
          {...(confirm.cargando ? { loadingLabel: confirm.cargando } : {})}
          {...(confirm.escribir ? { confirmText: confirm.escribir } : {})}
          tone={confirm.tono ?? 'danger'}
          onConfirm={async () => {
            const ok = await correr()
            // Si falla, el diálogo sigue abierto para reintentar o cancelar
            // (en la vista de ejemplo se cierra: no hay nada que reintentar).
            if (!ok && !demo) throw new Error('accion-fallida')
          }}
        />
      ) : null}
    </>
  )
}
