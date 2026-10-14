'use client'

import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import { setAiProvider, setMaintenanceMode } from '@/lib/admin/actions'
import { ETIQUETA_PROVEEDOR_IA } from './etiquetas'
import { usePanel } from './PanelContext'
import { useAccion } from './useAccion'

/**
 * Ajustes globales (docs/DISENO.md §6.12): una Card por ajuste, cada una con
 * su propio guardado. Activar el mantenimiento pide confirmación.
 */

export function AjusteMantenimiento({
  enabled,
  message,
}: {
  enabled: boolean
  message: string
}) {
  const id = useId()
  const { demo } = usePanel()
  const ejecutar = useAccion()
  const [activo, setActivo] = useState(enabled)
  const [mensaje, setMensaje] = useState(message)
  const [confirmar, setConfirmar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const hayCambios = activo !== enabled || mensaje.trim() !== message.trim()

  const guardar = async (): Promise<boolean> => {
    setGuardando(true)
    const ok = await ejecutar(
      () => setMaintenanceMode(activo, mensaje.trim()),
      {
        exito: activo
          ? 'Modo mantenimiento activado'
          : enabled
            ? 'Modo mantenimiento desactivado'
            : 'Mensaje guardado',
        error: 'No se pudo guardar el mantenimiento',
      }
    )
    setGuardando(false)
    return ok
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (!hayCambios) return
    if (activo && !enabled) setConfirmar(true)
    else void guardar()
  }

  return (
    <Card as="section" aria-labelledby={`${id}-titulo`}>
      <form onSubmit={enviar} className="flex flex-col gap-5">
        <div>
          <h2 id={`${id}-titulo`} className="text-title text-fg">
            Modo mantenimiento
          </h2>
          <p className="mt-0.5 text-body-s text-fg-muted">
            Avisa a los viajeros de que Wayio está en mantenimiento.
          </p>
        </div>
        <Callout tone="info">
          La web y la app todavía no leen este interruptor: al guardarlo queda
          publicado para cuando lo hagan.
        </Callout>
        <Switch
          checked={activo}
          onCheckedChange={setActivo}
          label="Activar el modo mantenimiento"
          description={activo ? 'Activado' : 'Desactivado'}
        />
        <Textarea
          label="Mensaje"
          optional
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          maxLength={500}
          placeholder="Estamos mejorando Wayio. Vuelve en unos minutos."
          className="min-h-24"
        />
        <div className="flex flex-wrap items-center justify-end gap-3">
          {hayCambios ? (
            <span className="text-caption text-fg-muted">
              Cambios sin guardar
            </span>
          ) : null}
          <Button
            type="submit"
            variant="tinta"
            disabled={!hayCambios}
            loading={guardando}
            loadingText="Guardando…"
          >
            Guardar mantenimiento
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirmar}
        onClose={() => setConfirmar(false)}
        tone="neutral"
        title="¿Activar el modo mantenimiento?"
        description="Queda publicado con tu mensaje para la web y la app."
        confirmLabel="Activar mantenimiento"
        loadingLabel="Activando…"
        onConfirm={async () => {
          const ok = await guardar()
          if (!ok && !demo) throw new Error('accion-fallida')
        }}
      />
    </Card>
  )
}

const PROVEEDORES = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'groq', label: 'Groq (pruebas)' },
] as const

type Proveedor = (typeof PROVEEDORES)[number]['value']

export function AjusteProveedorIa({
  provider,
  proveedorEntorno,
}: {
  provider: string
  /** Proveedor que usa de verdad el servidor (variable AI_PROVIDER). */
  proveedorEntorno: string
}) {
  const id = useId()
  const ejecutar = useAccion()
  const inicial: Proveedor = provider === 'groq' ? 'groq' : 'anthropic'
  const [valor, setValor] = useState<Proveedor>(inicial)
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (valor === inicial) return
    setGuardando(true)
    await ejecutar(() => setAiProvider(valor), {
      exito: 'Proveedor de IA guardado',
      error: 'No se pudo guardar el proveedor',
    })
    setGuardando(false)
  }

  return (
    <Card as="section" aria-labelledby={`${id}-titulo`}>
      <form onSubmit={enviar} className="flex flex-col gap-5">
        <div>
          <h2 id={`${id}-titulo`} className="text-title text-fg">
            Proveedor de IA preferido
          </h2>
          <p className="mt-0.5 text-body-s text-fg-muted">
            La app usa hoy el proveedor configurado en el servidor (
            {ETIQUETA_PROVEEDOR_IA[proveedorEntorno] ?? proveedorEntorno}). Este
            ajuste queda registrado como referencia para coordinar el cambio.
          </p>
        </div>
        <Segmented
          label="Proveedor de IA preferido"
          options={PROVEEDORES}
          value={valor}
          onValueChange={setValor}
          className="self-start max-sm:w-full"
          fullWidth={false}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="tinta"
            disabled={valor === inicial}
            loading={guardando}
            loadingText="Guardando…"
          >
            Guardar proveedor
          </Button>
        </div>
      </form>
    </Card>
  )
}
