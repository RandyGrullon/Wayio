'use client'

import { useState } from 'react'
import type { PlaceFromVideo, VideoAnalysisResult } from '@/lib/ai/analyzeVideo'

interface RecreateTripProps {
  onConfirm: (destino: string, lugares: PlaceFromVideo[]) => void
  onClose: () => void
}

export function RecreateTrip({ onConfirm, onClose }: RecreateTripProps) {
  const [videoUrl, setVideoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VideoAnalysisResult | null>(null)
  const [selectedDestino, setSelectedDestino] = useState('')

  const handleAnalyze = async () => {
    if (!videoUrl.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl }),
      })
      if (!res.ok) throw new Error('Error analizando el video')
      const data = (await res.json()) as VideoAnalysisResult
      setResult(data)
      setSelectedDestino(data.destinoSugerido)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    if (!result) return
    onConfirm(selectedDestino, result.lugares)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Recrea este viaje</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-500">
          Pega el link de un video de viaje (YouTube, Instagram, TikTok) y la IA
          identificará los lugares y creará tu itinerario.
        </p>

        {!result ? (
          <div className="flex flex-col gap-3">
            <input
              type="url"
              placeholder="https://youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <button
              onClick={handleAnalyze}
              disabled={loading || !videoUrl.trim()}
              className="rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Analizando video...' : 'Analizar video'}
            </button>
            {loading ? (
              <p className="text-center text-xs text-gray-400">
                Descargando y analizando frames con IA... esto puede tardar 1-2
                min
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs font-semibold uppercase text-blue-600">
                Destino sugerido
              </p>
              <input
                type="text"
                value={selectedDestino}
                onChange={(e) => setSelectedDestino(e.target.value)}
                className="mt-1 w-full rounded border border-blue-200 bg-white px-2 py-1.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <p className="mt-1 text-xs text-blue-700">{result.resumen}</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-gray-700">
                Lugares identificados ({result.lugares.length})
              </p>
              <ul className="max-h-52 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-100">
                {result.lugares.map((l, idx) => (
                  <li key={idx} className="flex items-center gap-2 px-3 py-2">
                    <span className="text-xs font-medium text-gray-900 flex-1">
                      {l.lugar}
                    </span>
                    <span className="text-xs text-gray-400">{l.pais}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                      {Math.round(l.confianza * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Crear itinerario con estos lugares
              </button>
              <button
                onClick={() => setResult(null)}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50"
              >
                Volver
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
