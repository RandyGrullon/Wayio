import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '@/lib/supabase/config'

/**
 * Modo mantenimiento (app_settings.maintenance_mode, lo guarda el admin).
 *
 * Lo usan /api/config (para los clientes) y, ANTES de todo lo demás, las
 * rutas que gastan IA al generar o ajustar (/api/generate,
 * /api/generate/stream y /api/adjust): con el mantenimiento activo responden
 * 503 `{ error: <mensaje>, code: 'mantenimiento' }` sin llegar a la sesión,
 * los límites, el tope ni el cupo.
 *
 * - Lee con la ANON key (app_settings tiene lectura pública por RLS).
 * - Caché de 30 s por instancia (igual que el max-age de /api/config) y una
 *   sola lectura en vuelo a la vez.
 * - Falla ABIERTO: sin Supabase, o si la lectura falla o tarda más de 2 s,
 *   se conserva el último valor conocido (o «sin mantenimiento»). Es un
 *   interruptor del admin, no un control de acceso: un fallo de lectura no
 *   tumba la generación.
 */

export const CODIGO_MANTENIMIENTO = 'mantenimiento'

/** Texto por defecto (el del seed de supabase/schema.sql). */
export const MENSAJE_MANTENIMIENTO =
  'Estamos en mantenimiento, volvemos pronto.'

export interface Mantenimiento {
  enabled: boolean
  message?: string
}

const CACHE_MS = 30_000
/** Si la lectura falla, se reintenta como pronto pasado este tiempo. */
const CACHE_FALLO_MS = 10_000
const LECTURA_TIMEOUT_MS = 2_000
const MAX_MENSAJE = 500

const SIN_MANTENIMIENTO: Mantenimiento = { enabled: false }

/** Normaliza el `value` jsonb de app_settings.maintenance_mode. */
export function normalizarMantenimiento(valor: unknown): Mantenimiento {
  const crudo =
    typeof valor === 'object' && valor !== null && !Array.isArray(valor)
      ? (valor as Record<string, unknown>)
      : {}
  const resultado: Mantenimiento = { enabled: crudo['enabled'] === true }
  const mensaje = crudo['message']
  if (typeof mensaje === 'string' && mensaje.trim()) {
    resultado.message = mensaje.trim().slice(0, MAX_MENSAJE)
  }
  return resultado
}

let cache: { valor: Mantenimiento; hasta: number } | null = null
let enCurso: Promise<Mantenimiento> | null = null

async function consultar(): Promise<Mantenimiento> {
  const control = new AbortController()
  const temporizador = setTimeout(() => control.abort(), LECTURA_TIMEOUT_MS)
  try {
    const client = createClient(
      process.env['NEXT_PUBLIC_SUPABASE_URL'] as string,
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] as string,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const { data, error } = await client
      .from('app_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .abortSignal(control.signal)
      .maybeSingle()
    if (error) throw error
    const valor = normalizarMantenimiento(
      (data as { value: unknown } | null)?.value
    )
    cache = { valor, hasta: Date.now() + CACHE_MS }
    return valor
  } catch {
    // Falla abierto: el último valor conocido o «sin mantenimiento».
    const valor = cache?.valor ?? SIN_MANTENIMIENTO
    cache = { valor, hasta: Date.now() + CACHE_FALLO_MS }
    return valor
  } finally {
    clearTimeout(temporizador)
  }
}

/** Estado del mantenimiento (cacheado; nunca lanza). */
export async function leerMantenimiento(): Promise<Mantenimiento> {
  if (!isSupabaseConfigured()) return SIN_MANTENIMIENTO
  if (cache && cache.hasta > Date.now()) return cache.valor
  enCurso ??= consultar().finally(() => {
    enCurso = null
  })
  return enCurso
}

/**
 * 503 `{ error, code: 'mantenimiento' }` si el mantenimiento está activo, o
 * null si se puede seguir. Va lo PRIMERO en las rutas de generar y ajustar.
 */
export async function respuestaMantenimiento(): Promise<Response | null> {
  const estado = await leerMantenimiento()
  if (!estado.enabled) return null
  // Mismo cuerpo que jsonError de routeKit (sin importarlo: /api/config
  // también usa este módulo y no necesita la sesión ni el rate limit).
  return Response.json(
    {
      error: estado.message ?? MENSAJE_MANTENIMIENTO,
      code: CODIGO_MANTENIMIENTO,
    },
    { status: 503, headers: { 'Cache-Control': 'no-store' } }
  )
}
