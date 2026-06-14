import type { TripForm } from '@/lib/validations/tripForm'
import type { GenerateResult } from '@/lib/ai/generateTrips'

interface StreamCallbacks {
  onProgress?: (label: string) => void
}

/**
 * Genera el itinerario consumiendo el endpoint SSE (/api/generate/stream) y
 * reporta el progreso real vía `onProgress`. Devuelve el resultado completo.
 *
 * Lanza si la respuesta no es válida; el llamador debe caer a /api/generate.
 */
export async function streamGenerate(
  form: TripForm,
  noCache: boolean,
  { onProgress }: StreamCallbacks = {}
): Promise<GenerateResult> {
  const res = await fetch('/api/generate/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...form, noCache }),
  })

  if (!res.ok || !res.body) {
    throw new Error(`Stream no disponible (${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: GenerateResult | null = null

  const handleEvent = (raw: string): void => {
    // Cada bloque SSE puede traer varias líneas; solo nos importan las `data:`.
    const data = raw
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .join('')
    if (!data) return

    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch {
      return
    }
    const evt = parsed as {
      type?: string
      label?: string
      message?: string
      result?: GenerateResult
    }
    if (evt.type === 'progress' && evt.label) {
      onProgress?.(evt.label)
    } else if (evt.type === 'result' && evt.result) {
      result = evt.result
    } else if (evt.type === 'error') {
      throw new Error(evt.message ?? 'Error en el stream')
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Los eventos SSE se separan por una línea en blanco (\n\n).
    let sep = buffer.indexOf('\n\n')
    while (sep !== -1) {
      const chunk = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      handleEvent(chunk)
      sep = buffer.indexOf('\n\n')
    }
  }
  // Procesa cualquier resto sin doble salto final.
  if (buffer.trim()) handleEvent(buffer)

  if (!result) {
    throw new Error('El stream terminó sin resultado')
  }
  return result
}
