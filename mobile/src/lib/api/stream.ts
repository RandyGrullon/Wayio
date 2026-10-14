/**
 * Cliente SSE de POST /api/generate/stream (spec §6.3): genera el itinerario
 * con progreso REAL. Usa XMLHttpRequest porque en RN `fetch` no expone el
 * cuerpo en streaming; XHR sí entrega el texto de forma incremental.
 *
 * Igual que `streamGenerate` de la web (src/lib/ai/streamClient.ts): el error
 * indica con `started` si el servidor ya había empezado; en ese caso NO se
 * debe repetir la generación con POST /api/generate (ver `generarViaje` en
 * screens/crear/generar.ts).
 */
import { config } from '../../config'
import { authHeaders } from './http'
import type { GenerateResult, TripFormValues } from '../../types/planning'

export type Fase =
  | 'cache'
  | 'demo'
  | 'contexto'
  | 'plan'
  | 'ia'
  | 'dias'
  | 'coords'
  | 'listo'
  | 'error'

export interface EventoProgreso {
  fase: Fase
  label: string
  progreso?: number
}

const MENSAJE_RED =
  'No pudimos conectar con Wayio. Revisa tu conexión e inténtalo de nuevo.'
export const MENSAJE_GENERICO =
  'No pudimos trazar tu viaje. Inténtalo de nuevo.'

export class ErrorGeneracion extends Error {
  /** El servidor ya había empezado: no repetir la generación. */
  readonly started: boolean
  readonly status: number | null
  readonly cancelado: boolean
  /**
   * Cuerpo JSON del error del servidor, si lo hubo (p. ej. `campos` de un 400
   * de validación; ver `erroresDelServidor` en screens/crear/formulario.ts).
   */
  readonly data: Record<string, unknown> | null
  readonly retryAfter: number | null

  constructor(
    message: string,
    opciones: {
      started: boolean
      status?: number | null
      cancelado?: boolean
      data?: Record<string, unknown> | null
      retryAfter?: number | null
    }
  ) {
    super(message)
    this.name = 'ErrorGeneracion'
    this.started = opciones.started
    this.status = opciones.status ?? null
    this.cancelado = opciones.cancelado ?? false
    this.data = opciones.data ?? null
    this.retryAfter = opciones.retryAfter ?? null
  }
}

const FASES: readonly Fase[] = [
  'cache',
  'demo',
  'contexto',
  'plan',
  'ia',
  'dias',
  'coords',
  'listo',
  'error',
]

function esFase(v: unknown): v is Fase {
  return typeof v === 'string' && (FASES as readonly string[]).includes(v)
}

/** Mensaje apto para el usuario a partir de un cuerpo de error JSON. */
function mensajeDe(data: unknown, porDefecto: string): string {
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    for (const k of ['mensaje', 'error', 'message']) {
      const v = o[k]
      // Descarta códigos técnicos («checkout_unavailable»): sin espacios.
      if (typeof v === 'string' && v.trim().includes(' ')) return v
    }
  }
  return porDefecto
}

/**
 * Consume el SSE de /api/generate/stream. Lanza `ErrorGeneracion`; con
 * `started === false` el llamante puede caer una vez a POST /api/generate.
 */
export function streamGenerar(
  form: TripFormValues,
  noCache: boolean,
  onProgress: (e: EventoProgreso) => void,
  signal?: AbortSignal
): Promise<GenerateResult> {
  return new Promise((resolve, reject) => {
    ;(async () => {
      if (!config.apiUrl) {
        reject(
          new ErrorGeneracion(
            'Esta versión de la app todavía no puede trazar viajes. Inténtalo más tarde.',
            { started: true }
          )
        )
        return
      }
      const headers = await authHeaders()
      if (signal?.aborted) {
        reject(
          new ErrorGeneracion('Cancelado', { started: false, cancelado: true })
        )
        return
      }

      const xhr = new XMLHttpRequest()
      let leido = 0
      let buffer = ''
      let started = false
      let resultado: GenerateResult | null = null
      let cerrado = false

      const fallar = (e: ErrorGeneracion): void => {
        if (cerrado) return
        cerrado = true
        reject(e)
      }

      const evento = (raw: string): void => {
        const data = raw
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('')
        if (!data) return
        let obj: unknown
        try {
          obj = JSON.parse(data)
        } catch {
          return
        }
        started = true
        const ev = obj as {
          type?: string
          fase?: unknown
          label?: unknown
          progreso?: unknown
          message?: unknown
          result?: GenerateResult
          demo?: unknown
        }
        if (ev.type === 'progress' && esFase(ev.fase)) {
          onProgress({
            fase: ev.fase,
            label: typeof ev.label === 'string' ? ev.label : '',
            ...(typeof ev.progreso === 'number'
              ? { progreso: ev.progreso }
              : {}),
          })
        } else if (ev.type === 'result' && ev.result) {
          resultado =
            ev.demo === true ? { ...ev.result, demo: true } : ev.result
        } else if (ev.type === 'error') {
          xhr.abort()
          fallar(
            new ErrorGeneracion(
              typeof ev.message === 'string' && ev.message
                ? ev.message
                : MENSAJE_GENERICO,
              { started: true }
            )
          )
        }
      }

      const procesar = (): void => {
        const texto = xhr.responseText ?? ''
        if (texto.length <= leido) return
        buffer += texto.slice(leido)
        leido = texto.length
        let sep = buffer.indexOf('\n\n')
        while (sep !== -1) {
          const chunk = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          evento(chunk)
          sep = buffer.indexOf('\n\n')
        }
      }

      xhr.open('POST', `${config.apiUrl}/api/generate/stream`)
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.setRequestHeader('Accept', 'text/event-stream')
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
      xhr.responseType = 'text'

      xhr.onprogress = () => {
        if (xhr.status >= 200 && xhr.status < 300) procesar()
      }
      xhr.onload = () => {
        if (cerrado) return
        if (xhr.status < 200 || xhr.status >= 300) {
          let data: unknown = null
          try {
            data = JSON.parse(xhr.responseText)
          } catch {
            data = null
          }
          const status = xhr.status
          const retry = Number(xhr.getResponseHeader('retry-after'))
          // 4xx: los datos no valen o hay límite; repetir en /api/generate no ayuda.
          fallar(
            new ErrorGeneracion(
              status === 429
                ? mensajeDe(
                    data,
                    'Has trazado muchos viajes seguidos. Espera un momento y vuelve a intentarlo.'
                  )
                : mensajeDe(data, MENSAJE_GENERICO),
              {
                started: status >= 400 && status < 500,
                status,
                data:
                  data && typeof data === 'object' && !Array.isArray(data)
                    ? (data as Record<string, unknown>)
                    : null,
                retryAfter: Number.isFinite(retry) && retry > 0 ? retry : null,
              }
            )
          )
          return
        }
        procesar()
        if (buffer.trim()) evento(buffer)
        if (cerrado) return
        if (!resultado) {
          fallar(new ErrorGeneracion(MENSAJE_GENERICO, { started }))
          return
        }
        cerrado = true
        resolve(resultado)
      }
      xhr.onerror = () => {
        fallar(new ErrorGeneracion(MENSAJE_RED, { started }))
      }
      xhr.ontimeout = () => {
        fallar(new ErrorGeneracion(MENSAJE_RED, { started }))
      }
      signal?.addEventListener('abort', () => {
        xhr.abort()
        fallar(new ErrorGeneracion('Cancelado', { started, cancelado: true }))
      })

      xhr.send(JSON.stringify({ ...form, noCache }))
    })().catch(() => {
      // Fallo al preparar la petición: nunca dejar la promesa colgada.
      reject(new ErrorGeneracion(MENSAJE_RED, { started: false }))
    })
  })
}
