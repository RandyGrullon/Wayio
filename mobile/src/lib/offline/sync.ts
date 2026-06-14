import * as Network from 'expo-network'
import {
  loadPendingSync,
  clearPendingSync,
  type PendingSyncRecord,
} from './storage'

const SUPABASE_URL = process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? ''
const SUPABASE_ANON_KEY = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? ''

async function pushRecord(record: PendingSyncRecord): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/activity_states?activity_id=eq.${record.activityId}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        estado: record.estado,
        hora_entrada: record.horaEntrada ?? null,
        hora_salida: record.horaSalida ?? null,
        updated_at: record.updatedAt,
      }),
    }
  )
  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`)
  }
}

export async function syncPendingChanges(): Promise<void> {
  const state = await Network.getNetworkStateAsync()
  if (!state.isConnected) return

  const pending = await loadPendingSync()
  if (pending.length === 0) return

  await Promise.all(pending.map(pushRecord))
  await clearPendingSync()
}
