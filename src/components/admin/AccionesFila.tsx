'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Ellipsis,
  ExternalLink,
  Eye,
  Map as MapIcon,
  Pencil,
  Trash2,
  User,
} from 'lucide-react'
import { buttonClasses } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import type { MenuItem } from '@/components/ui/Menu'
import { ConfirmDialog } from '@/components/ui/Modal'
import type { ActionResult } from '@/types/admin'
import type { ConfirmacionAccion } from './ActionButton'
import { usePanel } from './PanelContext'
import { useAccion } from './useAccion'
import { CLASE_MENU_FIJO, useMenuFijo } from './useMenuFijo'

const ICONOS = {
  ver: Eye,
  viaje: MapIcon,
  usuario: User,
  editar: Pencil,
  borrar: Trash2,
  externo: ExternalLink,
} as const

export type IconoAccion = keyof typeof ICONOS

export type AccionFila =
  | {
      tipo: 'enlace'
      clave: string
      label: string
      href: string
      icono?: IconoAccion
    }
  | {
      tipo: 'accion'
      clave: string
      label: string
      action: () => Promise<ActionResult>
      confirm: ConfirmacionAccion
      error: string
      exito?: string
      icono?: IconoAccion
      /** Destructiva: va al final, separada y en text-danger. */
      peligro?: boolean
      redirigirA?: string
    }

/**
 * Menú de acciones de una fila (docs/DISENO.md §5.13): disparador
 * MoreHorizontal de 44; las destructivas van al final, separadas, en
 * text-danger y siempre con ConfirmDialog. El panel es fijo (useMenuFijo):
 * la tabla no lo recorta aunque sea la última fila.
 */
export function AccionesFila({
  etiqueta,
  acciones,
}: {
  /** «Acciones de ana@ejemplo.com». */
  etiqueta: string
  acciones: readonly AccionFila[]
}) {
  const router = useRouter()
  const { demo } = usePanel()
  const ejecutar = useAccion()
  const menuFijo = useMenuFijo()
  const [abierta, setAbierta] = useState<string | null>(null)
  // La última acción elegida se conserva al cerrar: el diálogo mantiene su
  // texto durante la animación de salida (si no, parpadea vacío).
  const [ultima, setUltima] = useState<string | null>(null)

  const ordenadas = [
    ...acciones.filter((a) => a.tipo === 'enlace' || !a.peligro),
    ...acciones.filter((a) => a.tipo === 'accion' && a.peligro),
  ]
  const primeraPeligro = ordenadas.findIndex(
    (a) => a.tipo === 'accion' && a.peligro
  )

  const items: MenuItem[] = ordenadas.map((a, i) => {
    const Icono = a.icono ? ICONOS[a.icono] : null
    const base = {
      key: a.clave,
      label: a.label,
      ...(Icono ? { icon: <Icono /> } : {}),
      ...(i === primeraPeligro && i > 0 ? { separatorBefore: true } : {}),
    }
    if (a.tipo === 'enlace') return { ...base, href: a.href }
    return {
      ...base,
      ...(a.peligro ? { tone: 'danger' as const } : {}),
      onSelect: () => {
        setUltima(a.clave)
        setAbierta(a.clave)
      },
    }
  })

  const actual = acciones.find(
    (a): a is Extract<AccionFila, { tipo: 'accion' }> =>
      a.tipo === 'accion' && a.clave === ultima
  )

  return (
    <>
      <span className="inline-flex" {...menuFijo}>
        <Menu
          label={etiqueta}
          trigger={<Ellipsis aria-hidden="true" strokeWidth={1.75} />}
          triggerClassName={buttonClasses({ variant: 'ghost', size: 'icon' })}
          items={items}
          className={CLASE_MENU_FIJO}
        />
      </span>
      <ConfirmDialog
        open={abierta !== null && actual !== undefined}
        onClose={() => setAbierta(null)}
        title={actual?.confirm.titulo ?? ''}
        description={actual?.confirm.descripcion}
        confirmLabel={actual?.confirm.confirmar ?? 'Confirmar'}
        {...(actual?.confirm.cargando
          ? { loadingLabel: actual.confirm.cargando }
          : {})}
        {...(actual?.confirm.escribir
          ? { confirmText: actual.confirm.escribir }
          : {})}
        tone={actual?.confirm.tono ?? 'danger'}
        onConfirm={async () => {
          if (!actual) return
          const ok = await ejecutar(actual.action, {
            error: actual.error,
            ...(actual.exito ? { exito: actual.exito } : {}),
          })
          // Cada action revalida la vista desde la que se usa (borrar un
          // mensaje o un gasto revalida también la ficha de su viaje): la
          // respuesta de la action ya trae la pantalla al día.
          if (ok && actual.redirigirA) router.push(actual.redirigirA)
          if (!ok && !demo) throw new Error('accion-fallida')
        }}
      />
    </>
  )
}
