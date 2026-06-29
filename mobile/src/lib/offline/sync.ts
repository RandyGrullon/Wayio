import * as Network from 'expo-network'
import { config } from '../../config'
import { getSupabase } from '../supabase/client'
import {
  loadPendingSync,
  clearPendingSync,
  type PendingSyncRecord,
} from './storage'

/**
 * Pushes the offline geofencing queue to Supabase.
 *
 * Goes through the shared authenticated client (which carries the user's JWT
 * from AsyncStorage), NOT a raw anon-key fetch — otherwise row-level security
 * rejects every write, the queue is never cleared, and it grows unbounded.
 *
 * Safe when Supabase isn't configured or there's no session: it becomes a
 * no-op instead of throwing, so the live-tracking screen never crashes.
 */
export async function syncPendingChanges(): Promise<void> {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return

  const state = await Network.getNetworkStateAsync()
  if (!state.isConnected) return

  const pending = await loadPendingSync()
  if (pending.length === 0) return

  const supabase = getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // No authenticated session → keep the queue and retry once signed in.
  if (!user) return

  const rows = pending.map((record: PendingSyncRecord) => ({
    activity_id: record.activityId,
    trip_id: record.tripId,
    user_id: user.id,
    estado: record.estado,
    hora_entrada: record.horaEntrada ?? null,
    hora_salida: record.horaSalida ?? null,
    updated_at: record.updatedAt,
  }))

  // Upsert so a first-time activity row is created and later events overwrite it.
  const { error } = await supabase
    .from('activity_states')
    .upsert(rows, { onConflict: 'activity_id' })

  // On failure keep the queue intact so the next tick retries; only clear on success.
  if (error) return
  await clearPendingSync()
}
