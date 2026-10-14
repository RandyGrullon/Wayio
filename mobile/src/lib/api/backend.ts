/**
 * Cliente de los endpoints de IA del backend web de Wayio (Next.js), que
 * guardan las API keys secretas. Todas las llamadas envían
 * `Authorization: Bearer <access_token>` de la sesión de Supabase y los
 * errores llegan como `BackendError` con un mensaje en español para el usuario.
 */
import type {
  GenerateResult,
  TripFormValues,
  PlanningActivity,
  PlanningDay,
  PlanningTrip,
  Conflict,
} from '../../types/planning'
import { BackendError, postJSON } from './http'

export { BackendError } from './http'
export type { BackendErrorCode } from './http'

/**
 * Tiempo límite de los endpoints de IA largos (generate, adjust y
 * analyze-video tienen maxDuration = 300 s en el servidor). El resto usa el
 * de http.ts (60 s).
 */
const TIEMPO_IA_LARGA_MS = 300_000

/** Genera los 3 paquetes de itinerario (basico/confort/premium) + clima. */
export function generateTrip(form: TripFormValues): Promise<GenerateResult> {
  return postJSON<GenerateResult>('/api/generate', form, {
    timeoutMs: TIEMPO_IA_LARGA_MS,
  })
}

export interface VideoPlace {
  lugar: string
  pais?: string
  region?: string
  tipo?: string
  actividades?: string[]
  confianza?: number
}

export interface VideoAnalysisResult {
  lugares: VideoPlace[]
  /** Destino sugerido ('' si no se reconoció ningún lugar). */
  destinoSugerido: string
  resumen: string
  /** true si es un resultado de ejemplo (IA no disponible). */
  demo?: boolean
  /** true si solo se analizó parte del video. */
  parcial?: boolean
}

/**
 * Analiza un video de viaje por URL (TikTok / Reels / YouTube…) para sugerir
 * el destino. Requiere sesión. Si el análisis de video está desactivado en el
 * servidor lanza BackendError('unavailable') con un mensaje amable.
 */
export function analyzeVideoUrl(
  videoUrl: string
): Promise<VideoAnalysisResult> {
  return postJSON<VideoAnalysisResult>(
    '/api/analyze-video',
    { videoUrl },
    { timeoutMs: TIEMPO_IA_LARGA_MS }
  )
}

/** Analiza una foto del lugar (base64, JPG/PNG/WebP, ≤ 5 MB). */
export function analyzeImage(
  imageBase64: string,
  mediaType?: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<VideoAnalysisResult> {
  return postJSON<VideoAnalysisResult>(
    '/api/analyze-video',
    {
      imageBase64,
      ...(mediaType ? { mediaType } : {}),
    },
    { timeoutMs: TIEMPO_IA_LARGA_MS }
  )
}

export interface RescheduleSlot {
  dia: number
  desde: string
  hasta: string
}

export interface RescheduleResult {
  /** Actividad ya reagendada (mismo id y coordenadas). */
  activity: PlanningActivity
  /** Día (1-based) donde queda la actividad. */
  dia: number
  /** Día (1-based) del que venía. */
  diaOriginal: number
  /** Explicación breve para el viajero. */
  nota: string
  /** Huecos libres que se consideraron. */
  huecos: RescheduleSlot[]
}

/**
 * Pide a la IA un nuevo horario para una actividad perdida (el viaje debe
 * estar guardado). Lanza BackendError; en `error.data.huecos` vienen los huecos
 * libres cuando la IA no está disponible, para ofrecer el cambio manual.
 */
export function rescheduleActivityDetailed(
  activityId: string,
  tripId: string,
  reason?: string
): Promise<RescheduleResult> {
  return postJSON<RescheduleResult>('/api/reschedule', {
    activityId,
    tripId,
    ...(reason ? { reason } : {}),
  })
}

/**
 * Versión compatible: devuelve solo la actividad, o null si algo falla.
 * Preferir `rescheduleActivityDetailed` para mostrar el error y mover la
 * actividad al día propuesto (`dia`).
 */
export async function rescheduleActivity(
  activityId: string,
  tripId: string,
  reason: string
): Promise<PlanningActivity | null> {
  try {
    const { activity } = await rescheduleActivityDetailed(
      activityId,
      tripId,
      reason
    )
    return activity
  } catch {
    return null
  }
}

export interface AdjustResult {
  trip: PlanningTrip
  /** 1-2 frases explicando qué cambió la IA. */
  resumenCambios: string
}

/**
 * Ajusta un itinerario con IA ("hazlo más barato", "añade un día de playa"…).
 * Conserva fechas, personas, moneda y el estado de cada actividad. Lanza
 * BackendError con el mensaje para mostrar.
 */
export async function adjustTripDetailed(
  trip: PlanningTrip,
  instruccion: string
): Promise<AdjustResult> {
  const data = await postJSON<Partial<AdjustResult>>(
    '/api/adjust',
    { trip, instruccion },
    { timeoutMs: TIEMPO_IA_LARGA_MS }
  )
  if (!data.trip) {
    throw new BackendError(
      'server',
      'No se pudo ajustar el itinerario. Inténtalo de nuevo.'
    )
  }
  return { trip: data.trip, resumenCambios: data.resumenCambios ?? '' }
}

/** Versión compatible: devuelve solo el viaje ajustado. */
export async function adjustTrip(
  trip: PlanningTrip,
  instruccion: string
): Promise<PlanningTrip> {
  return (await adjustTripDetailed(trip, instruccion)).trip
}

export type ValidationAiState =
  | 'no_solicitada'
  | 'ok'
  | 'cache'
  | 'no_disponible'
  | 'limite'
  | 'error'

export interface ValidationResult {
  conflicts: Conflict[]
  ia: { estado: ValidationAiState }
}

/**
 * Valida el itinerario. Por defecto solo reglas locales (gratis, sin IA);
 * con `{ ia: true }` añade la revisión con IA (usar bajo demanda, no en cada
 * cambio).
 */
export async function validateScheduleDetailed(
  dias: PlanningDay[],
  opciones: { ia?: boolean } = {}
): Promise<ValidationResult> {
  const data = await postJSON<Partial<ValidationResult>>('/api/validate', {
    dias,
    ...(opciones.ia ? { ia: true } : {}),
  })
  return {
    conflicts: Array.isArray(data.conflicts) ? data.conflicts : [],
    ia: data.ia ?? { estado: 'no_solicitada' },
  }
}

/** Versión compatible: solo los conflictos ([] si algo falla). */
export async function validateSchedule(
  dias: PlanningDay[],
  opciones: { ia?: boolean } = {}
): Promise<Conflict[]> {
  try {
    return (await validateScheduleDetailed(dias, opciones)).conflicts
  } catch {
    return []
  }
}
