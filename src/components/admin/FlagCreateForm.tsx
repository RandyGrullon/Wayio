'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertFlag } from '@/lib/admin/actions'
import type { Platform } from '@/types/admin'

export function FlagCreateForm() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [key, setKey] = useState('')
  const [description, setDescription] = useState('')
  const [platform, setPlatform] = useState<Platform>('all')
  const [enabled, setEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await upsertFlag({ key, description, platform, enabled })
      if (res.ok) {
        setKey('')
        setDescription('')
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">
          Clave
        </label>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="nueva_funcion"
          required
          className="w-44 rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-500">
          Descripción
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Qué controla esta flag"
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">
          Plataforma
        </label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="all">Todas</option>
          <option value="web">Web</option>
          <option value="mobile">Mobile</option>
        </select>
      </div>
      <label className="flex items-center gap-1.5 pb-1.5 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Activa
      </label>
      <button
        disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? 'Guardando…' : 'Crear / Actualizar'}
      </button>
      {error ? <p className="w-full text-xs text-red-600">{error}</p> : null}
    </form>
  )
}
