'use client'

import { useState, useTransition } from 'react'
import { setMaintenanceMode, setAiProvider } from '@/lib/admin/actions'

export function SettingsPanel({
  maintenanceEnabled,
  maintenanceMessage,
  aiProvider,
}: {
  maintenanceEnabled: boolean
  maintenanceMessage: string
  aiProvider: string
}) {
  const [pending, start] = useTransition()
  const [enabled, setEnabled] = useState(maintenanceEnabled)
  const [message, setMessage] = useState(maintenanceMessage)
  const [provider, setProvider] = useState(aiProvider)
  const [note, setNote] = useState<string | null>(null)

  const saveMaintenance = () => {
    setNote(null)
    start(async () => {
      const res = await setMaintenanceMode(enabled, message)
      setNote(res.ok ? 'Guardado ✓' : res.error)
    })
  }

  const saveProvider = (value: string) => {
    setProvider(value)
    setNote(null)
    start(async () => {
      const res = await setAiProvider(value as 'anthropic' | 'groq')
      setNote(res.ok ? 'Guardado ✓' : res.error)
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Modo mantenimiento</h3>
            <p className="text-sm text-gray-500">
              Bandera global que web y mobile leen vía <code>/api/config</code>.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            {enabled ? 'Activado' : 'Desactivado'}
          </label>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="Mensaje que se muestra durante el mantenimiento"
          className="mt-3 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={saveMaintenance}
          disabled={pending}
          className="mt-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Guardar mantenimiento
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="font-semibold text-gray-900">
          Proveedor de IA preferido
        </h3>
        <p className="text-sm text-gray-500">
          Queda registrado en <code>app_settings</code>. El código lee la env{' '}
          <code>AI_PROVIDER</code> en runtime; usa esto como fuente de verdad
          para coordinar el cambio entre Claude (prod) y Groq (pruebas).
        </p>
        <select
          value={provider}
          onChange={(e) => saveProvider(e.target.value)}
          disabled={pending}
          className="mt-3 rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="groq">Groq (gratis, pruebas)</option>
          <option value="anthropic">Anthropic / Claude (producción)</option>
        </select>
      </div>

      {note ? <p className="text-sm text-gray-500">{note}</p> : null}
    </div>
  )
}
