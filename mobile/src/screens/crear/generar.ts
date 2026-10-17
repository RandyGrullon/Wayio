/**
 * Generación del itinerario con progreso REAL (spec §6.3). El cliente SSE de
 * POST /api/generate/stream vive en lib/api/stream.ts; aquí solo se decide
 * el respaldo.
 *
 * Igual que la web: si el stream ya había empezado (`started`), NO se repite
 * la generación; solo si ni siquiera arrancó se cae a POST /api/generate.
 */
import { BackendError } from '../../lib/api/http'
import { generateTrip } from '../../lib/api/backend'
import {
  ErrorGeneracion,
  MENSAJE_GENERICO,
  streamGenerar,
  type EventoProgreso,
} from '../../lib/api/stream'
import type { GenerateResult } from '../../types/planning'
import type { FormularioViaje } from './formulario'

/**
 * Traza el viaje con fases reales. Si el stream no llega a arrancar, cae una
 * sola vez al endpoint clásico (sin fases intermedias: se queda en
 * «Itinerario»).
 */
export async function generarViaje(
  form: FormularioViaje,
  {
    onProgress,
    signal,
    noCache = false,
  }: {
    onProgress: (e: EventoProgreso) => void
    signal?: AbortSignal
    noCache?: boolean
  }
): Promise<GenerateResult> {
  try {
    return await streamGenerar(form, noCache, onProgress, signal)
  } catch (err) {
    if (!(err instanceof ErrorGeneracion) || err.started || err.cancelado) {
      throw err
    }
    onProgress({ fase: 'ia', label: 'La IA arma 3 versiones de tu viaje' })
    try {
      const r = await generateTrip(form)
      if (signal?.aborted) {
        throw new ErrorGeneracion('Cancelado', {
          started: true,
          cancelado: true,
        })
      }
      return r
    } catch (e) {
      if (e instanceof ErrorGeneracion) throw e
      if (e instanceof BackendError) {
        throw new ErrorGeneracion(e.message, {
          started: true,
          status: e.status,
          data: e.data,
          retryAfter: e.retryAfter,
          code: e.serverCode,
        })
      }
      throw new ErrorGeneracion(MENSAJE_GENERICO, { started: true })
    }
  }
}
