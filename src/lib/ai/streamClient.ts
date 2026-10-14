import type { TripForm } from '@/lib/validations/tripForm'
import type { GenerateResult, ProgressEvent } from '@/lib/ai/generateTrips'

interface StreamCallbacks {
  /** Hito real del backend (fase + texto legible + avance 0..1 si lo hay). */
  onProgress?: (event: ProgressEvent) => void
  signal?: AbortSignal
}

/** Datos que el servidor adjunta a un error (cuerpo JSON de un 4xx o evento SSE). */
export interface DetalleStreamError {
  /** Errores por campo de un 400 (`flatten().fieldErrors` de zod). */
  campos?: Record<string, string[]> | null
  /** Segundos hasta poder reintentar (429; cuerpo o cabecera Retry-After). */
  retryAfter?: number | null
  /** Código del servidor (p. ej. 'rate_limit' en el evento `error`). */
  code?: string | null
  /** Mensaje del servidor, ya en español (`mensaje` o `error` del cuerpo). */
  mensaje?: string | null
}

/**
 * Error del streaming. `started` indica si el servidor ya había empezado a
 * emitir eventos: en ese caso la generación SÍ se ejecutó (y se facturó) y el
 * llamador NO debe repetirla con /api/generate; solo debe caer al endpoint
 * clásico cuando el stream ni siquiera arrancó (started === false).
 *
 * En un 4xx también vale `started`: el formulario no es válido (400) o se
 * superó el límite (429) y repetir en /api/generate no ayuda. El cuerpo JSON
 * queda en `campos` (400), `retryAfter` (429), `code` y `mensaje`.
 */
export class StreamGenerateError extends Error {
  readonly started: boolean
  readonly status: number | null
  readonly campos: Record<string, string[]> | null
  readonly retryAfter: number | null
  readonly code: string | null
  readonly mensaje: string | null

  constructor(
    message: string,
    started: boolean,
    status: number | null = null,
    detalle: DetalleStreamError = {}
  ) {
    super(message)
    this.name = 'StreamGenerateError'
    this.started = started
    this.status = status
    this.campos = detalle.campos ?? null
    this.retryAfter = detalle.retryAfter ?? null
    this.code = detalle.code ?? null
    this.mensaje = detalle.mensaje ?? null
  }
}

const texto = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v : null

const segundos = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : null
}

/** `campos` del 400: solo las listas de textos no vacías. */
function leerCampos(v: unknown): Record<string, string[]> | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const campos: Record<string, string[]> = {}
  for (const [campo, lista] of Object.entries(v)) {
    if (!Array.isArray(lista)) continue
    const mensajes = lista.filter(
      (x): x is string => typeof x === 'string' && x.trim() !== ''
    )
    if (mensajes.length > 0) campos[campo] = mensajes
  }
  return Object.keys(campos).length > 0 ? campos : null
}

/** Lee el cuerpo JSON de un 4xx (si no es JSON, solo la cabecera Retry-After). */
async function detalleDeRespuesta(res: Response): Promise<DetalleStreamError> {
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  const cuerpo =
    typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
  return {
    campos: leerCampos(cuerpo['campos']),
    retryAfter:
      segundos(cuerpo['retryAfter']) ??
      segundos(res.headers.get('Retry-After')),
    code: texto(cuerpo['code']),
    mensaje: texto(cuerpo['mensaje']) ?? texto(cuerpo['error']),
  }
}

/**
 * Genera el itinerario consumiendo el endpoint SSE (/api/generate/stream) y
 * reporta el progreso real vía `onProgress`. Devuelve el resultado completo.
 *
 * Lanza StreamGenerateError; ver `started` para decidir si reintentar.
 */
export async function streamGenerate(
  form: TripForm,
  noCache: boolean,
  { onProgress, signal }: StreamCallbacks = {}
): Promise<GenerateResult> {
  let res: Response
  try {
    res = await fetch('/api/generate/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, noCache }),
      ...(signal ? { signal } : {}),
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new StreamGenerateError('Stream no disponible', false)
  }

  if (!res.ok || !res.body) {
    // 4xx: el formulario no es válido o hay límite; repetir en /api/generate
    // no ayuda. Su cuerpo JSON trae los errores por campo o la espera.
    const es4xx = res.status >= 400 && res.status < 500
    const detalle = es4xx ? await detalleDeRespuesta(res) : {}
    throw new StreamGenerateError(
      `Stream no disponible (${res.status})`,
      es4xx,
      res.status,
      detalle
    )
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let started = false
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
    started = true
    const evt = parsed as {
      type?: string
      fase?: ProgressEvent['fase']
      label?: string
      progreso?: unknown
      message?: string
      code?: unknown
      result?: GenerateResult
    }
    if (evt.type === 'progress' && evt.label && evt.fase) {
      const progreso =
        typeof evt.progreso === 'number' && Number.isFinite(evt.progreso)
          ? Math.min(1, Math.max(0, evt.progreso))
          : null
      onProgress?.({
        fase: evt.fase,
        label: evt.label,
        ...(progreso !== null ? { progreso } : {}),
      })
    } else if (evt.type === 'result' && evt.result) {
      result = evt.result
    } else if (evt.type === 'error') {
      throw new StreamGenerateError(
        evt.message ?? 'Error en el stream',
        true,
        null,
        { code: texto(evt.code), mensaje: texto(evt.message) }
      )
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Los eventos SSE se separan por una línea en blanco (\n\n). Los
      // comentarios ": ping" (heartbeat) no traen data y se ignoran.
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
  } catch (err) {
    if (err instanceof StreamGenerateError) throw err
    if (signal?.aborted) throw err
    throw new StreamGenerateError('Se cortó la conexión', started)
  }

  if (!result) {
    throw new StreamGenerateError('El stream terminó sin resultado', started)
  }
  return result
}
