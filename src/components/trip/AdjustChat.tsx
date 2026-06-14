'use client'

import { useState } from 'react'
import { Sparkles, Send } from 'lucide-react'
import type { Trip } from '@/types/trip'

interface AdjustChatProps {
  trip: Trip
  onAdjusted: (trip: Trip) => void
}

const SUGERENCIAS = [
  'Hazlo más relajado',
  'Añade un día de playa',
  'Más barato',
  'Más actividades culturales',
  'Menos traslados',
] as const

export function AdjustChat({ trip, onAdjusted }: AdjustChatProps) {
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async (instruccion: string) => {
    const limpio = instruccion.trim()
    if (!limpio || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip, instruccion: limpio }),
      })
      const data = (await res.json()) as { trip?: Trip; error?: string }
      if (!res.ok || !data.trip) {
        throw new Error(data.error ?? 'No se pudo ajustar el itinerario.')
      }
      onAdjusted(data.trip)
      setTexto('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-3xl border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-500" />
        <p className="text-sm font-semibold text-fg">Ajusta tu viaje con IA</p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {SUGERENCIAS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={loading}
            onClick={() => void enviar(s)}
            className="rounded-full border border-brand-200 bg-surface px-3 py-1 text-xs font-medium text-fg-muted transition-colors hover:border-brand-400 hover:text-brand-600 disabled:opacity-50 dark:border-brand-500/30"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void enviar(texto)
        }}
        className="flex items-center gap-2"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={loading}
          placeholder="Ej.: añade un mercado local el día 2 y baja el presupuesto"
          className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-brand-400 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !texto.trim()}
          className="grad-brand inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {loading ? 'Ajustando...' : 'Enviar'}
        </button>
      </form>

      {error ? (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="mt-2 text-xs text-fg-subtle">
          La IA está reescribiendo tu itinerario. Esto puede tardar unos
          segundos.
        </p>
      ) : null}
    </div>
  )
}
