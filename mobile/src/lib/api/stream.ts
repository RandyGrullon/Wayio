/**
 * Cliente SSE de POST /api/generate/stream (spec §6.3): genera el itinerario
 * con progreso REAL. Usa XMLHttpRequest porque en RN `fetch` no expone el
 * cuerpo en streaming; XHR sí entrega el texto de forma incremental.
 *
 * Igual que `streamGenerate` de la web (src/lib/ai/streamClient.ts): el error
 * indica con `started` si el servidor ya había empezado; en ese caso NO se
 * debe repetir la generación con POST /api/generate (ver `generarViaje` en
 * screens/crear/generar.ts).
 *
 * Cupo del plan Gratis agotado: 402 `{ error, code: 'cupo_agotado', accion,
 * usados, limite, renueva }` ANTES de abrir el stream. Se conservan `code` y
 * `data` (ver `cupoAgotadoDe` en lib/api/limites.ts) y, como todo 4xx, sale
 * con `started: true`: no se repite ni se cae a POST /api/generate.
 *
 * Generar exige sesión: sin access_token no se llama. Ante un 401 (que el
 * servidor responde en JSON antes de abrir el stream) se refresca la sesión
 * UNA vez y se repite; si vuelve a dar 401 se muestra «Tu sesión expiró…»
 * (y si el refresco falla por la red, el error de conexión).
 */
import { config } from '../../config'
import {
  BackendError,
  CODIGO_AUTH_REQUIRED,
  MENSAJE_CUPO_AGOTADO,
  MENSAJE_SESION_EXPIRADA,
  refrescarToken,
  segundosDeEspera,
  tokenObligatorio,
} from './http'
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
  /**
   * Código técnico del servidor: `code` del JSON de error o del evento SSE
   * `{ type: 'error', code }` ('auth_required', 'rate_limit', 'tope_diario'…).
   * Nunca se muestra al usuario.
   */
  readonly code: string | null

  constructor(
    message: string,
    opciones: {
      started: boolean
      status?: number | null
      cancelado?: boolean
      data?: Record<string, unknown> | null
      retryAfter?: number | null
      code?: string | null
    }
  ) {
    super(message)
    this.name = 'ErrorGeneracion'
    this.started = opciones.started
    this.status = opciones.status ?? null
    this.cancelado = opciones.cancelado ?? false
    this.data = opciones.data ?? null
    this.retryAfter = opciones.retryAfter ?? null
    this.code = opciones.code ?? null
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

/** Texto no vacío o null. */
function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
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
 * Sesión caducada o rechazada. `started: true` para que `generarViaje` no lo
 * repita en POST /api/generate, que también lo rechazaría.
 */
function errorDeSesion(): ErrorGeneracion {
  return new ErrorGeneracion(MENSAJE_SESION_EXPIRADA, {
    started: true,
    status: 401,
    code: CODIGO_AUTH_REQUIRED,
  })
}

/** Respuesta HTTP no 2xx (JSON normal, antes de abrir el stream). */
function errorHttp(
  status: number,
  raw: string,
  cabeceraRetry: string | null
): ErrorGeneracion {
  let parsed: unknown = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = null
  }
  const data =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  const mensaje =
    status === 401
      ? MENSAJE_SESION_EXPIRADA
      : status === 402
        ? mensajeDe(data, MENSAJE_CUPO_AGOTADO)
        : status === 429
          ? mensajeDe(
              data,
              'Has trazado muchos viajes seguidos. Espera un momento y vuelve a intentarlo.'
            )
          : mensajeDe(data, MENSAJE_GENERICO)
  // 4xx: los datos no valen, falta la sesión, hay límite (personal o el tope
  // diario) o el cupo del mes se agotó (402): repetir en /api/generate no
  // ayuda y volvería a gastar cupo.
  return new ErrorGeneracion(mensaje, {
    started: status >= 400 && status < 500,
    status,
    data,
    retryAfter: segundosDeEspera(cabeceraRetry, data?.['retryAfter']),
    code: texto(data?.['code']),
  })
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
    let cerrado = false
    let started = false
    let xhrActual: XMLHttpRequest | null = null

    const fallar = (e: ErrorGeneracion): void => {
      if (cerrado) return
      cerrado = true
      reject(e)
    }
    const cancelado = (): ErrorGeneracion =>
      new ErrorGeneracion('Cancelado', { started, cancelado: true })

    /** Abre el stream con `token`; `reintento` = ya se refrescó tras un 401. */
    const intento = (token: string, reintento: boolean): void => {
      const xhr = new XMLHttpRequest()
      xhrActual = xhr
      let leido = 0
      let buffer = ''
      let resultado: GenerateResult | null = null

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
          code?: unknown
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
          // El `code` distingue, p. ej., el corte por tope diario de IA
          // ('tope_diario') a mitad de la generación.
          fallar(
            new ErrorGeneracion(
              typeof ev.message === 'string' && ev.message
                ? ev.message
                : MENSAJE_GENERICO,
              { started: true, code: texto(ev.code) }
            )
          )
        }
      }

      const procesar = (): void => {
        const recibido = xhr.responseText ?? ''
        if (recibido.length <= leido) return
        buffer += recibido.slice(leido)
        leido = recibido.length
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
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.responseType = 'text'

      xhr.onprogress = () => {
        if (xhr.status >= 200 && xhr.status < 300) procesar()
      }
      xhr.onload = () => {
        if (cerrado) return
        if (xhr.status < 200 || xhr.status >= 300) {
          const status = xhr.status
          if (status === 401 && !reintento) {
            // Token caducado o revocado: el 401 sale antes de abrir el stream
            // (no se gastó nada), así que se refresca UNA vez y se repite.
            void refrescarToken()
              .then((nuevo) => {
                if (cerrado) return
                if (signal?.aborted) {
                  fallar(cancelado())
                  return
                }
                if (nuevo.token && nuevo.token !== token) {
                  intento(nuevo.token, true)
                } else if (nuevo.sinRed) {
                  // El refresco falló por la red: la sesión sigue viva, así
                  // que no se dice «Tu sesión expiró» (igual que al empezar).
                  fallar(new ErrorGeneracion(MENSAJE_RED, { started: true }))
                } else {
                  fallar(errorDeSesion())
                }
              })
              .catch(() => fallar(errorDeSesion()))
            return
          }
          fallar(
            errorHttp(
              status,
              xhr.responseText ?? '',
              xhr.getResponseHeader('retry-after')
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

      xhr.send(JSON.stringify({ ...form, noCache }))
    }

    signal?.addEventListener('abort', () => {
      xhrActual?.abort()
      fallar(cancelado())
    })
    ;(async () => {
      if (!config.apiUrl) {
        fallar(
          new ErrorGeneracion(
            'Esta versión de la app todavía no puede trazar viajes. Inténtalo más tarde.',
            { started: true }
          )
        )
        return
      }
      // Sin access_token no se llama: solo daría 401 (y con `started: true`
      // tampoco se intenta POST /api/generate).
      let token: string
      try {
        token = await tokenObligatorio()
      } catch (e) {
        fallar(
          e instanceof BackendError && e.code === 'network'
            ? new ErrorGeneracion(MENSAJE_RED, { started: true })
            : errorDeSesion()
        )
        return
      }
      if (cerrado) return
      if (signal?.aborted) {
        fallar(cancelado())
        return
      }
      intento(token, false)
    })().catch(() => {
      // Fallo al preparar la petición: nunca dejar la promesa colgada.
      fallar(new ErrorGeneracion(MENSAJE_RED, { started: false }))
    })
  })
}
