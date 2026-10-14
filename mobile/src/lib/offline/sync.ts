import * as Network from 'expo-network'
import type { SupabaseClient } from '@supabase/supabase-js'
import { config } from '../../config'
import { getSupabase } from '../supabase/client'
import {
  loadPendingSync,
  clearPendingSync,
  addPendingSync,
  type PendingSyncRecord,
} from './storage'

/**
 * Pushes the offline geofencing queue to Supabase (tabla activity_states,
 * una fila por viaje + actividad + usuario).
 *
 * Goes through the shared authenticated client (which carries the user's JWT
 * from AsyncStorage), NOT a raw anon-key fetch — otherwise row-level security
 * rejects every write.
 *
 * Para que la cola nunca crezca sin límite:
 *  - se deduplica: solo cuenta el último cambio de cada (viaje, actividad);
 *  - el tripId encolado puede ser el id interno del JSON del viaje: se
 *    resuelve al id de la fila (trips.id); si el viaje ya no existe o no es
 *    accesible, esos registros se descartan;
 *  - se sube por viaje: un viaje sin permiso (RLS) se descarta, un fallo
 *    temporal (red, servidor) se reintenta en el siguiente tick.
 *
 * Safe when Supabase isn't configured or there's no session: it becomes a
 * no-op instead of throwing, so the live-tracking screen never crashes.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ESTADOS = new Set([
  'pendiente',
  'en_curso',
  'completada',
  'perdida',
  'recuperada',
])

interface ActivityStateUpsert {
  trip_id: string
  activity_id: string
  user_id: string
  estado: string
  hora_entrada: string | null
  hora_salida: string | null
  updated_at: string
}

function clave(r: PendingSyncRecord): string {
  return `${r.tripId}|${r.activityId}|${r.estado}|${r.updatedAt}`
}

function iso(v: string | undefined): string | null {
  if (!v) return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

/** Último registro de cada (viaje, actividad) según updatedAt. */
function deduplicar(registros: PendingSyncRecord[]): PendingSyncRecord[] {
  const ultimo = new Map<string, PendingSyncRecord>()
  for (const r of registros) {
    if (!r.tripId || !r.activityId || !ESTADOS.has(r.estado)) continue
    const k = `${r.tripId}|${r.activityId}`
    const previo = ultimo.get(k)
    const tR = Date.parse(r.updatedAt)
    const tP = previo ? Date.parse(previo.updatedAt) : Number.NEGATIVE_INFINITY
    if (!previo || !(tR < tP)) ultimo.set(k, r)
  }
  return [...ultimo.values()]
}

/**
 * id de la fila de trips para el tripId encolado (o null si no existe o no es
 * accesible). supabase-js NO lanza ante un fallo de red: devuelve `error` con
 * data null. Se lanza para que el llamador conserve los registros y los
 * reintente, en vez de descartarlos como si el viaje no existiera.
 */
async function resolverFila(
  supabase: SupabaseClient,
  tripId: string
): Promise<string | null> {
  if (UUID_RE.test(tripId)) {
    const { data, error } = await supabase
      .from('trips')
      .select('id')
      .eq('id', tripId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (data) return (data as { id: string }).id
  }
  const { data, error } = await supabase
    .from('trips')
    .select('id')
    .eq('data->>id', tripId)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? (data as { id: string }).id : null
}

/** Sustituye la cola guardada por `restantes`, sin perder lo que llegó mientras tanto. */
async function reescribirCola(
  procesados: Set<string>,
  restantes: PendingSyncRecord[]
): Promise<void> {
  const actual = await loadPendingSync()
  const nuevos = actual.filter((r) => !procesados.has(clave(r)))
  await clearPendingSync()
  for (const r of [...restantes, ...nuevos]) {
    await addPendingSync(r)
  }
}

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

  const procesados = new Set(pending.map(clave))
  const ultimos = deduplicar(pending)

  // Agrupar por viaje y resolver el id de la fila.
  const porViaje = new Map<string, PendingSyncRecord[]>()
  for (const r of ultimos) {
    const lista = porViaje.get(r.tripId) ?? []
    lista.push(r)
    porViaje.set(r.tripId, lista)
  }

  const restantes: PendingSyncRecord[] = []
  for (const [tripId, registros] of porViaje) {
    let filaId: string | null
    try {
      filaId = await resolverFila(supabase, tripId)
    } catch {
      restantes.push(...registros) // sin red: se reintenta
      continue
    }
    // El viaje no existe o ya no es accesible: descartar.
    if (!filaId) continue
    const fila = filaId

    const rows: ActivityStateUpsert[] = registros.map((r) => ({
      trip_id: fila,
      activity_id: r.activityId.slice(0, 200),
      user_id: user.id,
      estado: r.estado,
      hora_entrada: iso(r.horaEntrada),
      hora_salida: iso(r.horaSalida),
      updated_at: iso(r.updatedAt) ?? new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('activity_states')
      .upsert(rows, { onConflict: 'trip_id,activity_id,user_id' })

    if (!error) continue
    // Sin permiso (ya no es miembro) o datos inválidos: no se arreglará
    // reintentando. Cualquier otro error (red, tabla aún no creada): se
    // conserva el registro deduplicado para el siguiente intento.
    const definitivo =
      error.code === '42501' ||
      error.code === '23503' ||
      error.code === '23514' ||
      error.code === '22P02'
    if (!definitivo) restantes.push(...registros)
  }

  await reescribirCola(procesados, restantes)
}
