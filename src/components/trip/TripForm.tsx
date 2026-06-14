'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { PackageSelector } from '@/components/trip/PackageSelector'
import type { TripForm } from '@/lib/validations/tripForm'

const TIPOS_VIAJE = [
  { value: 'aventura', label: 'Aventura' },
  { value: 'relax', label: 'Relax' },
  { value: 'cultura', label: 'Cultura' },
  { value: 'familia', label: 'Familia' },
  { value: 'crucero', label: 'Crucero' },
  { value: 'romantico', label: 'Romántico' },
  { value: 'gastronomia', label: 'Gastronomía' },
] as const

interface TripFormProps {
  onSubmit: (data: TripForm) => Promise<void>
  loading?: boolean
}

type FormState = Partial<Omit<TripForm, 'moneda' | 'paquete'>> & {
  moneda: TripForm['moneda']
  paquete: TripForm['paquete']
  zona?: string
}

export function TripForm({ onSubmit, loading = false }: TripFormProps) {
  const [form, setForm] = useState<FormState>({
    destinoSorpresa: false,
    moneda: 'USD',
    paquete: 'confort',
    personas: 2,
    tipo: 'aventura',
    preferencias: [],
  })

  // Fecha mínima de salida = hoy; fecha mínima de regreso = día siguiente a la salida.
  const hoy = new Date().toISOString().slice(0, 10)
  const minRegreso = (() => {
    if (!form.fechaInicio) return hoy
    const d = new Date(form.fechaInicio)
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data: TripForm = {
      destino: form.destinoSorpresa ? 'Sorpresa' : (form.destino ?? ''),
      destinoSorpresa: form.destinoSorpresa ?? false,
      origen: form.origen ?? '',
      personas: form.personas ?? 1,
      fechaInicio: form.fechaInicio ?? '',
      fechaFin: form.fechaFin ?? '',
      presupuesto: form.presupuesto ?? 0,
      moneda: form.moneda,
      tipo: form.tipo ?? 'aventura',
      paquete: form.paquete,
      preferencias: form.preferencias,
      ...(form.tipo === 'crucero' && form.zona ? { zona: form.zona } : {}),
    }
    await onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label
        htmlFor="destinoSorpresa"
        className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface-muted/60 px-4 py-3 transition-colors hover:border-brand-300"
      >
        <input
          type="checkbox"
          id="destinoSorpresa"
          checked={form.destinoSorpresa ?? false}
          onChange={(e) =>
            setForm((f) => ({ ...f, destinoSorpresa: e.target.checked }))
          }
          className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
        />
        <span className="text-sm font-medium text-fg">
          ✨ Destino sorpresa{' '}
          <span className="text-fg-subtle">(la IA elige por mí)</span>
        </span>
      </label>

      {!form.destinoSorpresa ? (
        <Input
          id="destino"
          label="Destino"
          placeholder="París, Barcelona, Roma..."
          value={form.destino ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, destino: e.target.value }))}
          required
        />
      ) : null}

      <Input
        id="origen"
        label="Ciudad de origen"
        placeholder="¿Desde dónde sales?"
        value={form.origen ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, origen: e.target.value }))}
        required
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          id="fechaInicio"
          label="Fecha de salida"
          type="date"
          min={hoy}
          value={form.fechaInicio ?? ''}
          onChange={(e) => {
            const nuevaSalida = e.target.value
            setForm((f) => ({
              ...f,
              fechaInicio: nuevaSalida,
              // Si el regreso ya no es posterior a la salida, lo limpiamos.
              fechaFin:
                f.fechaFin && f.fechaFin <= nuevaSalida
                  ? ''
                  : (f.fechaFin ?? ''),
            }))
          }}
          required
        />
        <Input
          id="fechaFin"
          label="Fecha de regreso"
          type="date"
          min={minRegreso}
          value={form.fechaFin ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
          disabled={!form.fechaInicio}
          {...(form.fechaInicio
            ? {}
            : { hint: 'Elige primero la fecha de salida' })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          id="personas"
          label="Personas"
          type="number"
          min={1}
          max={20}
          value={String(form.personas ?? 2)}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              personas: parseInt(e.target.value, 10),
            }))
          }
          required
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="presupuesto" className="text-sm font-medium text-fg">
            Presupuesto total
          </label>
          <div className="flex">
            <input
              id="presupuesto"
              type="number"
              min={100}
              placeholder="2000"
              value={form.presupuesto ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  presupuesto: parseFloat(e.target.value),
                }))
              }
              required
              className="h-11 min-w-0 flex-1 rounded-l-xl border border-r-0 border-border-strong bg-surface px-3.5 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            />
            <select
              value={form.moneda}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  moneda: e.target.value as TripForm['moneda'],
                }))
              }
              className="h-11 rounded-r-xl border border-border-strong bg-surface-muted px-2 text-sm font-medium text-fg focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="DOP">DOP</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-fg">Tipo de viaje</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {TIPOS_VIAJE.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, tipo: value }))}
              className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all ${
                form.tipo === value
                  ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-[0_4px_12px_-4px_rgba(20,184,166,0.5)] dark:bg-brand-500/15 dark:text-brand-300'
                  : 'border-border bg-surface text-fg-muted hover:border-brand-300 hover:text-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {form.tipo === 'crucero' ? (
        <Input
          id="zona"
          label="Zona del crucero"
          placeholder="Caribe, Mediterráneo, Alaska..."
          value={form.zona ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value }))}
          required
        />
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-fg">Paquete</p>
        <PackageSelector
          value={form.paquete}
          onChange={(p) => setForm((f) => ({ ...f, paquete: p }))}
        />
      </div>

      <Button type="submit" size="lg" loading={loading} className="mt-2">
        Generar mi itinerario
      </Button>
    </form>
  )
}
