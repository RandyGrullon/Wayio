'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import type { ActionResult } from '@/types/admin'
import { usePanel } from './PanelContext'
import { useAccion } from './useAccion'

/**
 * Select CONTROLADO que aplica una server action (rol, plan, estado del
 * viaje) tras un ConfirmDialog. Muestra el valor nuevo de forma optimista y
 * vuelve al anterior si falla, con toast del resultado (§6.12).
 *
 * Los textos aceptan `{valor}`, que se sustituye por la etiqueta elegida:
 * confirmTitulo="¿Cambiar el rol a {valor}?".
 */
export function SelectAction({
  value,
  options,
  action,
  label,
  hint,
  disabled = false,
  confirmTitulo,
  confirmDescripcion,
  confirmar,
  exito,
  error,
  className,
}: {
  value: string
  options: readonly { value: string; label: string }[]
  action: (value: string) => Promise<ActionResult>
  label: string
  hint?: string
  disabled?: boolean
  confirmTitulo: string
  confirmDescripcion?: string
  /** Verbo del botón: «Cambiar rol». */
  confirmar: string
  exito: string
  error: string
  className?: string
}) {
  const { demo } = usePanel()
  const ejecutar = useAccion()
  const [mostrado, setMostrado] = useOptimistic(value)
  const [pendiente, setPendiente] = useState<string | null>(null)
  // Último valor elegido: el diálogo conserva «¿Cambiar el rol a Admin?»
  // mientras se cierra (si no, el texto parpadea sin el valor).
  const [elegido, setElegido] = useState<string | null>(null)
  const [cambiando, start] = useTransition()

  const etiquetaDe = (v: string) =>
    options.find((o) => o.value === v)?.label ?? v
  const con = (texto: string | undefined) =>
    texto?.split('{valor}').join(elegido ? etiquetaDe(elegido) : '')

  const aplicar = (nuevo: string) =>
    new Promise<void>((resolve, reject) => {
      start(async () => {
        setMostrado(nuevo)
        const ok = await ejecutar(() => action(nuevo), { exito, error })
        if (ok || demo) resolve()
        else reject(new Error('accion-fallida'))
      })
    })

  return (
    <>
      <Select
        fieldSize="md"
        label={label}
        hint={hint}
        value={pendiente ?? mostrado}
        options={options}
        disabled={disabled || cambiando}
        aria-busy={cambiando || undefined}
        {...(className ? { containerClassName: className } : {})}
        onChange={(e) => {
          const v = e.target.value
          if (v !== mostrado) {
            setElegido(v)
            setPendiente(v)
          }
        }}
      />
      <ConfirmDialog
        open={pendiente !== null}
        onClose={() => setPendiente(null)}
        tone="neutral"
        title={con(confirmTitulo) ?? ''}
        description={con(confirmDescripcion)}
        confirmLabel={confirmar}
        onConfirm={() => (pendiente === null ? undefined : aplicar(pendiente))}
      />
    </>
  )
}
