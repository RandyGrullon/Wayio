import 'server-only'
import { createHash } from 'crypto'
import { createAdminClientSafe } from '@/lib/supabase/admin'
import { aiModel, PROMPT_VERSION } from '@/lib/ai/config'
import type { TripForm } from '@/lib/validations/tripForm'

const CACHE_TTL_HOURS = 6

/**
 * Clave de caché: TODO lo que cambia el resultado (incluidos presupuesto,
 * moneda, descripción libre y la versión del prompt/modelo). Antes ignoraba
 * presupuesto y moneda y servía planes de otro usuario con otra moneda.
 */
function buildCacheKey(form: TripForm): string {
  const norm = (s: string | undefined): string => (s ?? '').trim().toLowerCase()
  const material = JSON.stringify({
    v: PROMPT_VERSION,
    modelo: aiModel('itinerario'),
    destino: form.destinoSorpresa ? '<sorpresa>' : norm(form.destino),
    origen: norm(form.origen),
    fechaInicio: form.fechaInicio,
    fechaFin: form.fechaFin,
    personas: form.personas,
    presupuesto: Math.round(form.presupuesto),
    moneda: form.moneda,
    tipo: form.tipo,
    paquete: form.paquete,
    zona: norm(form.zona),
    preferencias: [...(form.preferencias ?? [])].map(norm).sort(),
    lugares: [...(form.lugaresDeseados ?? [])].map(norm).sort(),
    descripcion: norm(form.descripcion),
  })
  return createHash('sha256').update(material).digest('hex').slice(0, 40)
}

export async function getCachedTrip(form: TripForm): Promise<string | null> {
  // Los destinos sorpresa no se cachean: cada vez debe ser una sorpresa.
  if (form.destinoSorpresa) return null
  const client = createAdminClientSafe()
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
  if (form.destinoSorpresa) return
  const client = createAdminClientSafe()
  if (!client) return

  try {
    const key = buildCacheKey(form)
    await client.from('trip_cache').upsert({
      key,
      data: json,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Un fallo de caché no debe romper la generación.
  }
}
