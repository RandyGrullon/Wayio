import type { Activity } from '@/types/activity'
import type { AlertMessage } from '@/types/alerts'

/**
 * Mensaje de la alerta de demora (nivel 3) con POST /api/alert-message, el
 * mismo que usa la app (mobile/src/lib/ai/generateAlertMessage.ts). El
 * prompt se construye en el servidor: aquí solo van datos estructurados y la
 * cookie de sesión. El servidor decide el plan: en Gratis responde su
 * mensaje determinista (`fuente: 'local'`) sin llamar a la IA.
 *
 * Nunca lanza: sin conexión, sin sesión (401), sin cupo (402), con el límite
 * por hora (429), con un 5xx, al agotar el tiempo o con una respuesta rara,
 * devuelve un texto fijo de respaldo (`fuente: 'respaldo'`).
 */

export const ENDPOINT_MENSAJE_ALERTA = '/api/alert-message'
/** La sugerencia no puede dejar la alerta «cargando» para siempre. */
export const TIEMPO_IA_MS = 20_000

const MAX_SIGUIENTES = 5
const HORA_RE = /^\d{1,2}:\d{2}$/

export type FuenteMensaje = 'ia' | 'local' | 'respaldo'

export interface MensajeAlerta extends AlertMessage {
  fuente: FuenteMensaje
}

const recortar = (s: string | undefined, max: number): string =>
  (s ?? '').trim().slice(0, max)

const hora = (s: string | undefined): string | undefined => {
  const h = (s ?? '').trim()
  return HORA_RE.test(h) ? h : undefined
}

/** Texto fijo cuando no hay respuesta útil del servidor. */
export function mensajeRespaldo(
  actividad: Pick<Activity, 'nombre'>,
  retrasoMinutos: number
): MensajeAlerta {
  const r = Math.max(0, Math.round(retrasoMinutos))
  const nombre = recortar(actividad.nombre, 120) || 'tu próxima actividad'
  return {
    mensajeAmigable: `Llevas ${r} min de retraso para ${nombre}. Puedes seguir con tu plan o mover la próxima actividad a otro día.`,
    actividadRecomendarQuitar: null,
    razonSimple: '',
    tiempoQueAhorra: 0,
    alternativa: null,
    fuente: 'respaldo',
  }
}

export interface OpcionesMensaje {
  nivel: 1 | 2 | 3 | 4 | 5
  esCrucero: boolean
}

/** Cuerpo de la petición (mismo contrato que valida la ruta con zod). */
export function cuerpoMensajeAlerta(
  actividad: Activity,
  restantes: readonly Activity[],
  retrasoMinutos: number,
  { nivel, esCrucero }: OpcionesMensaje
): Record<string, unknown> {
  const siguientes = restantes
    .filter((a) => a.id !== actividad.id)
    .slice(0, MAX_SIGUIENTES)
    .map((a) => {
      const horaInicio = hora(a.horaInicio)
      return {
        id: recortar(a.id, 120),
        nombre: recortar(a.nombre, 120) || 'Actividad',
        ...(horaInicio ? { horaInicio } : {}),
        ...(a.duracionMinutos > 0
          ? { duracionMinutos: Math.min(Math.round(a.duracionMinutos), 1440) }
          : {}),
        // Con reserva (o que la exige) o la vuelta al barco: nunca se propone quitarla.
        reservada:
          Boolean(a.reservaPagada) ||
          Boolean(a.reservaRequerida) ||
          a.puertoCrucero === true,
      }
    })

  const horaInicio = hora(actividad.horaInicio)
  const horaFin = hora(actividad.horaFin)
  return {
    actividad: {
      id: recortar(actividad.id, 120),
      nombre: recortar(actividad.nombre, 120) || 'Actividad',
      ...(horaInicio ? { horaInicio } : {}),
      ...(horaFin ? { horaFin } : {}),
      tipo: recortar(actividad.tipo, 40),
    },
    retrasoMinutos: Math.min(Math.max(Math.round(retrasoMinutos), 0), 1440),
    nivel,
    siguientes,
    esCrucero,
    idioma: 'es',
  }
}

const esRegistro = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Valida la respuesta del servidor; null si no sirve. */
export function leerMensaje(data: unknown): MensajeAlerta | null {
  if (!esRegistro(data)) return null
  const mensaje =
    typeof data.mensajeAmigable === 'string'
      ? data.mensajeAmigable.trim().slice(0, 400)
      : ''
  if (!mensaje) return null
  const quitar =
    typeof data.actividadRecomendarQuitar === 'string' &&
    data.actividadRecomendarQuitar.trim()
      ? data.actividadRecomendarQuitar.trim()
      : null
  const ahorra = Number(data.tiempoQueAhorra)
  return {
    mensajeAmigable: mensaje,
    actividadRecomendarQuitar: quitar,
    razonSimple:
      typeof data.razonSimple === 'string'
        ? data.razonSimple.trim().slice(0, 300)
        : '',
    tiempoQueAhorra: Number.isFinite(ahorra)
      ? Math.min(Math.max(Math.round(ahorra), 0), 600)
      : 0,
    alternativa:
      typeof data.alternativa === 'string' && data.alternativa.trim()
        ? data.alternativa.trim().slice(0, 300)
        : null,
    fuente: data.fuente === 'ia' ? 'ia' : 'local',
  }
}

export interface PedirMensajeOpciones extends OpcionesMensaje {
  /** Cancela la petición (al desmontar). */
  signal?: AbortSignal
  timeoutMs?: number
}

export async function pedirMensajeAlerta(
  actividad: Activity,
  restantes: readonly Activity[],
  retrasoMinutos: number,
  { signal, timeoutMs = TIEMPO_IA_MS, ...opciones }: PedirMensajeOpciones
): Promise<MensajeAlerta> {
  const respaldo = mensajeRespaldo(actividad, retrasoMinutos)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return respaldo
  }

  const control = new AbortController()
  const cancelar = () => control.abort()
  if (signal?.aborted) return respaldo
  signal?.addEventListener('abort', cancelar, { once: true })
  const temporizador = setTimeout(cancelar, timeoutMs)

  try {
    const res = await fetch(ENDPOINT_MENSAJE_ALERTA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        cuerpoMensajeAlerta(actividad, restantes, retrasoMinutos, opciones)
      ),
      signal: control.signal,
    })
    if (!res.ok) return respaldo
    const data: unknown = await res.json().catch(() => null)
    return leerMensaje(data) ?? respaldo
  } catch {
    return respaldo
  } finally {
    clearTimeout(temporizador)
    signal?.removeEventListener('abort', cancelar)
  }
}

const normalizar = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/**
 * La actividad que el mensaje propone quitar, solo si está entre las que
 * quedan hoy (por id o, en respuestas antiguas, por nombre).
 */
export function actividadRecomendada(
  mensaje: Pick<AlertMessage, 'actividadRecomendarQuitar'> | null,
  restantes: readonly Activity[]
): Activity | null {
  const ref = mensaje?.actividadRecomendarQuitar?.trim()
  if (!ref) return null
  const porId = restantes.find((a) => a.id === ref)
  if (porId) return porId
  const nombre = normalizar(ref)
  return restantes.find((a) => normalizar(a.nombre) === nombre) ?? null
}
