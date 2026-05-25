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
    }
    await onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="destinoSorpresa"
          checked={form.destinoSorpresa ?? false}
          onChange={(e) =>
            setForm((f) => ({ ...f, destinoSorpresa: e.target.checked }))
          }
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label
          htmlFor="destinoSorpresa"
          className="text-sm font-medium text-gray-700"
        >
          Destino sorpresa (la IA elige por mí)
        </label>
      </div>

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
          value={form.fechaInicio ?? ''}
          onChange={(e) =>
            setForm((f) => ({ ...f, fechaInicio: e.target.value }))
          }
          required
        />
        <Input
          id="fechaFin"
          label="Fecha de regreso"
          type="date"
          value={form.fechaFin ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
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
          <label
            htmlFor="presupuesto"
            className="text-sm font-medium text-gray-700"
          >
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
              className="min-w-0 flex-1 rounded-l-lg border border-r-0 border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={form.moneda}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  moneda: e.target.value as TripForm['moneda'],
                }))
              }
              className="rounded-r-lg border border-gray-300 bg-gray-50 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="DOP">DOP</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700">Tipo de viaje</p>
        <div className="grid grid-cols-4 gap-2">
          {TIPOS_VIAJE.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, tipo: value }))}
              className={`rounded-lg border-2 px-2 py-2 text-xs font-medium transition-colors ${
                form.tipo === value
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700">Paquete</p>
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
