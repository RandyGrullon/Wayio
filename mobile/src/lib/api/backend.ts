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
  PlanTier,
  Conflict,
} from '../../types/planning'
import { ACCIONES_CON_CUPO, type AccionConCupo } from '../../constants/pricing'
import { BackendError, getJSON, postJSON } from './http'

export { BackendError } from './http'
export type { BackendErrorCode } from './http'

/**
 * Tiempo límite de los endpoints de IA largos (generate, adjust y
 * analyze-video tienen maxDuration = 300 s en el servidor). El resto usa el
 * de http.ts (60 s).
 */
const TIEMPO_IA_LARGA_MS = 300_000

/**
 * Opciones de las rutas de IA que exigen sesión en el servidor (generate,
 * adjust, analyze-video): sin access_token no se llaman (ver http.ts).
 */
const IA_CON_SESION = {
  timeoutMs: TIEMPO_IA_LARGA_MS,
  requiereSesion: true,
} as const

/**
 * Genera los 3 paquetes de itinerario (basico/confort/premium) + clima.
 * Requiere sesión; con el tope diario de IA agotado lanza BackendError
 * ('rate_limit', serverCode 'tope_diario').
 */
export function generateTrip(form: TripFormValues): Promise<GenerateResult> {
  return postJSON<GenerateResult>('/api/generate', form, IA_CON_SESION)
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
 * servidor lanza BackendError('unavailable') con un mensaje amable; con el
 * tope diario de IA agotado, BackendError('rate_limit', serverCode
 * 'tope_diario').
 */
export function analyzeVideoUrl(
  videoUrl: string
): Promise<VideoAnalysisResult> {
  return postJSON<VideoAnalysisResult>(
    '/api/analyze-video',
    { videoUrl },
    IA_CON_SESION
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
    IA_CON_SESION
  )
}

export interface RescheduleSlot {
  /** Día 1-based del viaje guardado. */
  dia: number
  /** 'HH:MM' */
  desde: string
  /** 'HH:MM' */
  hasta: string
}

const HORA_RE = /^\d{1,2}:\d{2}$/

/**
 * Huecos libres que el servidor manda en el cuerpo de un error de reschedule
 * (503 'ia_no_disponible', p. ej. motivo 'requiere_pro' o 'tope_diario'),
 * validados. [] si no hay o no tienen la forma esperada.
 */
export function huecosDelError(
  data: Record<string, unknown> | null | undefined
): RescheduleSlot[] {
  const lista = data?.['huecos']
  if (!Array.isArray(lista)) return []
  return lista.filter((h): h is RescheduleSlot => {
    if (!h || typeof h !== 'object') return false
    const o = h as Record<string, unknown>
    return (
      typeof o['dia'] === 'number' &&
      Number.isInteger(o['dia']) &&
      o['dia'] >= 1 &&
      typeof o['desde'] === 'string' &&
      HORA_RE.test(o['desde']) &&
      typeof o['hasta'] === 'string' &&
      HORA_RE.test(o['hasta'])
    )
  })
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
 * BackendError con el mensaje para mostrar; con el tope diario de IA agotado,
 * 503 'ia_no_disponible' (motivo 'tope_diario') para ofrecer editar a mano.
 */
export async function adjustTripDetailed(
  trip: PlanningTrip,
  instruccion: string
): Promise<AdjustResult> {
  const data = await postJSON<Partial<AdjustResult>>(
    '/api/adjust',
    { trip, instruccion },
    IA_CON_SESION
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

// ── GET /api/cupo ──────────────────────────────────────────────────────────

export interface UsoCupo {
  usados: number
  limite: number
}

export interface CupoDelMes {
  /** Plan según el servidor (null si no lo pudo saber). */
  tier: PlanTier | null
  /** Uso del mes por acción; null = plan sin cupo (Pro). */
  cupos: Record<AccionConCupo, UsoCupo> | null
  /** 'YYYY-MM-DD' en que se renueva el cupo ('' si no vino). */
  renueva: string
  /** El conteo puede no estar al día (el servidor lo marca así). */
  aproximado: boolean
}

function esTierServidor(v: unknown): v is PlanTier {
  return v === 'free' || v === 'pro' || v === 'grupo'
}

function leerUso(v: unknown): UsoCupo | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const usados = o['usados']
  const limite = o['limite']
  if (
    typeof usados !== 'number' ||
    typeof limite !== 'number' ||
    !Number.isFinite(usados) ||
    !Number.isFinite(limite)
  ) {
    return null
  }
  return {
    usados: Math.max(0, Math.round(usados)),
    limite: Math.max(0, Math.round(limite)),
  }
}

/**
 * Uso del mes de las acciones de IA con cupo (plan Gratis). Exige sesión
 * (401 sin ella). Lanza BackendError; un cuerpo con forma inesperada cuenta
 * como error del servidor.
 */
export async function getCupo(): Promise<CupoDelMes> {
  const data = await getJSON<Record<string, unknown>>('/api/cupo', {
    requiereSesion: true,
  })
  const tier = esTierServidor(data['tier']) ? data['tier'] : null
  let cupos: Record<AccionConCupo, UsoCupo> | null = null
  const crudo = data['cupos']
  if (crudo !== null && crudo !== undefined) {
    if (typeof crudo !== 'object') {
      throw new BackendError(
        'server',
        'No pudimos leer tu uso del mes. Inténtalo de nuevo.'
      )
    }
    const o = crudo as Record<string, unknown>
    const leidos: Partial<Record<AccionConCupo, UsoCupo>> = {}
    for (const accion of ACCIONES_CON_CUPO) {
      const uso = leerUso(o[accion])
      if (!uso) {
        throw new BackendError(
          'server',
          'No pudimos leer tu uso del mes. Inténtalo de nuevo.'
        )
      }
      leidos[accion] = uso
    }
    cupos = leidos as Record<AccionConCupo, UsoCupo>
  }
  const renueva = data['renueva']
  return {
    tier,
    cupos,
    renueva:
      typeof renueva === 'string' && /^\d{4}-\d{2}-\d{2}/.test(renueva)
        ? renueva.slice(0, 10)
        : '',
    aproximado: data['aproximado'] === true,
  }
}
