/** Supabase CRUD for trips — the mobile equivalent of the web /api/trips routes. */
import { getSupabase } from '../supabase/client'
import type {
  PlanningTrip,
  PlanningActivity,
  TripRow,
} from '../../types/planning'

export async function listTrips(): Promise<TripRow[]> {
  const supabase = getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as TripRow[]
}

export async function getTrip(id: string): Promise<TripRow | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as TripRow
}

export async function createTrip(trip: PlanningTrip): Promise<TripRow> {
  const supabase = getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: user.id,
      data: trip,
      paquete: trip.paquete,
      grupo_link: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
      estado: 'planificando',
      actividades_pendientes: [],
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as TripRow
}

export async function updateTrip(
  id: string,
  patch: { data?: PlanningTrip; actividades_pendientes?: PlanningActivity[] }
): Promise<void> {
  const supabase = getSupabase()
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (patch.data !== undefined) update['data'] = patch.data
  if (patch.actividades_pendientes !== undefined)
    update['actividades_pendientes'] = patch.actividades_pendientes

  const { error } = await supabase.from('trips').update(update).eq('id', id)
  if (error) throw new Error(error.message)
}
