'use client'

import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Menu } from '@/components/ui/Menu'
import { ConfirmDialog, Drawer } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import { upsertFlag } from '@/lib/admin/actions'
import type { ActionResult, FeatureFlagRow, Platform } from '@/types/admin'
import { usePanel } from './PanelContext'
import { useAccion } from './useAccion'
import { CLASE_MENU_FIJO, useMenuFijo } from './useMenuFijo'

const PLATAFORMAS: readonly { value: Platform; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'web', label: 'Web' },
  { value: 'mobile', label: 'App móvil' },
]

/** Misma normalización que upsertFlag (minúsculas y _ en vez de espacios). */
function normalizarClave(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, '_')
}

function errorDeClave(k: string): string | undefined {
  if (!k) return 'Escribe una clave, por ejemplo «nuevo_mapa».'
  if (!/^[a-z0-9_.-]+$/.test(k)) {
    return 'Usa solo minúsculas, números, puntos, guiones o guiones bajos.'
  }
  return undefined
}

/** Valor guardado → texto editable (vacío si es {}). */
function textoDeValor(valor: Record<string, unknown> | null | undefined) {
  if (!valor || Object.keys(valor).length === 0) return ''
  try {
    return JSON.stringify(valor, null, 2)
  } catch {
    return ''
  }
}

type LecturaValor =
  | { ok: true; valor: Record<string, unknown> }
  | { ok: false; error: string }

/** Texto del campo → objeto JSON (vacío = {}), con el error en español. */
function leerValor(texto: string): LecturaValor {
  const limpio = texto.trim()
  if (!limpio) return { ok: true, valor: {} }
  let valor: unknown
  try {
    valor = JSON.parse(limpio)
  } catch {
    return {
      ok: false,
      error:
        'No es un JSON válido: las claves y los textos van entre comillas dobles y no puede sobrar ninguna coma.',
    }
  }
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return {
      ok: false,
      error: 'Debe ser un objeto entre llaves, por ejemplo {"porcentaje": 20}.',
    }
  }
  return { ok: true, valor: valor as Record<string, unknown> }
}

/**
 * Formulario de creación y edición de una función (feature flag) dentro de un
 * Drawer (sheet en móvil). En edición la clave no cambia: cambiarla crearía
 * otra función.
 */
function FormularioFuncion({
  inicial,
  onListo,
  onCancelar,
}: {
  inicial?: FeatureFlagRow
  onListo: () => void
  onCancelar: () => void
}) {
  const id = useId()
  const ejecutar = useAccion()
  const [clave, setClave] = useState(inicial?.key ?? '')
  const [descripcion, setDescripcion] = useState(inicial?.description ?? '')
  const [plataforma, setPlataforma] = useState<Platform>(
    inicial?.platform ?? 'all'
  )
  const [activa, setActiva] = useState(inicial?.enabled ?? true)
  const [valorTexto, setValorTexto] = useState(() =>
    textoDeValor(inicial?.value)
  )
  const [errorClave, setErrorClave] = useState<string | undefined>()
  const [errorValor, setErrorValor] = useState<string | undefined>()
  const [guardando, setGuardando] = useState(false)
  const editando = Boolean(inicial)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const k = normalizarClave(clave)
    const fallaClave = errorDeClave(k)
    const lectura = leerValor(valorTexto)
    setErrorClave(fallaClave)
    setErrorValor(lectura.ok ? undefined : lectura.error)
    if (fallaClave || !lectura.ok) return
    setGuardando(true)
    const ok = await ejecutar(
      () =>
        upsertFlag({
          key: k,
          enabled: activa,
          description: descripcion.trim(),
          platform: plataforma,
          value: lectura.valor,
        }),
      {
        exito: editando ? 'Cambios guardados' : 'Función creada',
        error: editando
          ? 'No se pudieron guardar los cambios'
          : 'No se pudo crear la función',
      }
    )
    setGuardando(false)
    if (ok) onListo()
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <Input
        fieldSize="md"
        label="Clave"
        value={clave}
        onChange={(e) => setClave(e.target.value)}
        disabled={editando}
        error={errorClave}
        hint={
          editando
            ? 'La clave no se puede cambiar.'
            : 'Así la leerán la web y la app: minúsculas y guiones bajos.'
        }
        placeholder="nuevo_mapa"
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
        data-autofocus={editando ? undefined : true}
      />
      <Input
        fieldSize="md"
        label="Descripción"
        optional
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="Qué controla esta función"
        maxLength={160}
        data-autofocus={editando ? true : undefined}
      />
      <div className="flex flex-col">
        <span
          id={`${id}-plataforma`}
          className="mb-1.5 block text-label text-fg"
        >
          Plataforma
        </span>
        <Segmented
          labelledBy={`${id}-plataforma`}
          options={PLATAFORMAS}
          value={plataforma}
          onValueChange={setPlataforma}
          fullWidth
        />
      </div>
      <Textarea
        label="Valor (JSON)"
        optional
        value={valorTexto}
        onChange={(e) => {
          setValorTexto(e.target.value)
          if (errorValor) setErrorValor(undefined)
        }}
        onBlur={() => {
          const lectura = leerValor(valorTexto)
          setErrorValor(lectura.ok ? undefined : lectura.error)
        }}
        error={errorValor}
        hint="Un objeto con la configuración que leerán la web y la app. Vacío = {}."
        placeholder={'{\n  "porcentaje": 20\n}'}
        maxLength={10_000}
        showCount={false}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        className="font-mono"
      />
      <Switch
        checked={activa}
        onCheckedChange={setActiva}
        label="Activa"
        description="Si está apagada, la web y la app la verán desactivada."
      />
      <div className="mt-2 flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="tinta"
          loading={guardando}
          loadingText="Guardando…"
        >
          {editando ? 'Guardar cambios' : 'Crear función'}
        </Button>
      </div>
    </form>
  )
}

/** Botón «Nueva función» de la cabecera de /admin/flags. */
export function BotonNuevaFuncion() {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <Button variant="tinta" icon={<Plus />} onClick={() => setAbierto(true)}>
        Nueva función
      </Button>
      <Drawer
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Nueva función"
        description="Un interruptor remoto que la web y la app podrán consultar."
      >
        <FormularioFuncion
          onListo={() => setAbierto(false)}
          onCancelar={() => setAbierto(false)}
        />
      </Drawer>
    </>
  )
}

/** Menú de la fila: Editar (Drawer precargado) y Eliminar (confirmación). */
export function AccionesFuncion({
  flag,
  eliminar,
}: {
  flag: FeatureFlagRow
  eliminar: () => Promise<ActionResult>
}) {
  const { demo } = usePanel()
  const ejecutar = useAccion()
  const menuFijo = useMenuFijo()
  const [editar, setEditar] = useState(false)
  const [borrar, setBorrar] = useState(false)

  return (
    <>
      <span className="inline-flex" {...menuFijo}>
        <Menu
          label={`Acciones de la función ${flag.key}`}
          trigger={<Ellipsis aria-hidden="true" strokeWidth={1.75} />}
          triggerClassName={buttonClasses({ variant: 'ghost', size: 'icon' })}
          className={CLASE_MENU_FIJO}
          items={[
            {
              key: 'editar',
              label: 'Editar',
              icon: <Pencil />,
              onSelect: () => setEditar(true),
            },
            {
              key: 'eliminar',
              label: 'Eliminar función',
              icon: <Trash2 />,
              tone: 'danger',
              separatorBefore: true,
              onSelect: () => setBorrar(true),
            },
          ]}
        />
      </span>
      <Drawer
        open={editar}
        onClose={() => setEditar(false)}
        title="Editar función"
        description={flag.key}
      >
        <FormularioFuncion
          inicial={flag}
          onListo={() => setEditar(false)}
          onCancelar={() => setEditar(false)}
        />
      </Drawer>
      <ConfirmDialog
        open={borrar}
        onClose={() => setBorrar(false)}
        title="¿Eliminar esta función?"
        description="Si la web o la app la consultan, la verán como desactivada."
        confirmLabel="Eliminar función"
        loadingLabel="Eliminando…"
        confirmText={flag.key}
        onConfirm={async () => {
          const ok = await ejecutar(eliminar, {
            exito: 'Función eliminada',
            error: 'No se pudo eliminar la función',
          })
          if (!ok && !demo) throw new Error('accion-fallida')
        }}
      />
    </>
  )
}
