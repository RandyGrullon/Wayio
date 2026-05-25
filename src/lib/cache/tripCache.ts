import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import type { TripForm } from '@/lib/validations/tripForm'

const CACHE_TTL_HOURS = 6

function buildCacheKey(form: TripForm): string {
  const str = [
    form.destino,
    form.origen,
    form.fechaInicio,
    form.fechaFin,
    String(form.personas),
    form.tipo,
    form.paquete,
  ].join(':')
  return createHash('sha256').update(str).digest('hex').slice(0, 32)
}

function getClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) return null
  return createClient(url, key)
}

export async function getCachedTrip(form: TripForm): Promise<string | null> {
  const client = getClient()
  if (!client) return null

  try {
    const key = buildCacheKey(form)
    const cutoff = new Date(
      Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000
    ).toISOString()

    const { data } = await client
      .from('trip_cache')
      .select('data')
      .eq('key', key)
      .gte('created_at', cutoff)
      .maybeSingle()

    const row = data as { data: string } | null
    return row?.data ?? null
  } catch {
    return null
  }
}

export async function saveCachedTrip(
  form: TripForm,
  json: string
): Promise<void> {
  const client = getClient()
  if (!client) return

  try {
    const key = buildCacheKey(form)
    await client.from('trip_cache').upsert({
      key,
      data: json,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Cache write failure is non-fatal
  }
}
