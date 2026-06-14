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
