/**
 * Thin client for the Wayio web (Next.js) AI endpoints. These hold the secret
 * API keys (Anthropic, Amadeus, Google Maps…) and do NOT require auth, so the
 * mobile app can call them over plain HTTP.
 */
import { config, assertBackendConfigured } from '../../config'
import type {
  GenerateResult,
  TripFormValues,
  PlanningActivity,
  PlanningDay,
  PlanningTrip,
  Conflict,
} from '../../types/planning'

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  assertBackendConfigured()
  const res = await fetch(`${config.apiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`Backend ${path} respondió ${res.status}`)
  }
  return (await res.json()) as T
}

/** Generate the 3 AI itinerary packages (basico/confort/premium) + weather. */
export function generateTrip(form: TripFormValues): Promise<GenerateResult> {
  return postJSON<GenerateResult>('/api/generate', form)
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
  destinoSugerido: string
  resumen: string
}

/**
 * Analyze a travel video by URL (TikTok / Reels / YouTube…) and get the
 * suggested destination to pre-fill a new trip. Mirrors the web "Desde un
 * video" flow → `/api/analyze-video`. Without an AI key the backend returns a
 * demo result, so this never hard-fails on a missing key.
 */
export function analyzeVideoUrl(
  videoUrl: string
): Promise<VideoAnalysisResult> {
  return postJSON<VideoAnalysisResult>('/api/analyze-video', { videoUrl })
}

/** Ask the AI to reschedule a lost activity. Requires the trip to be saved. */
export async function rescheduleActivity(
  activityId: string,
  tripId: string,
  reason: string
): Promise<PlanningActivity | null> {
  try {
    const { activity } = await postJSON<{ activity: PlanningActivity }>(
      '/api/reschedule',
      { activityId, tripId, reason }
    )
    return activity
  } catch {
    return null
  }
}

/**
 * Ask the AI to adjust an existing itinerary ("hazlo más barato", "añade un día
 * de playa"…). Returns the full rewritten trip, or throws on a backend error so
 * the caller can show the message. Mirrors the web `AdjustChat` → `/api/adjust`.
 */
export async function adjustTrip(
  trip: PlanningTrip,
  instruccion: string
): Promise<PlanningTrip> {
  assertBackendConfigured()
  const res = await fetch(`${config.apiUrl}/api/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trip, instruccion }),
  })
  const data = (await res.json()) as { trip?: PlanningTrip; error?: string }
  if (!res.ok || !data.trip) {
    throw new Error(data.error ?? 'No se pudo ajustar el itinerario.')
  }
  return data.trip
}

/** Validate a day list for schedule conflicts. */
export async function validateSchedule(
  dias: PlanningDay[]
): Promise<Conflict[]> {
  try {
    const { conflicts } = await postJSON<{ conflicts: Conflict[] }>(
      '/api/validate',
      { dias }
    )
    return conflicts
  } catch {
    return []
  }
}
