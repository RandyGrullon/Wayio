import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '@/lib/supabase/config'

/**
 * Remote config para web y mobile. Devuelve feature flags, anuncios activos y
 * el estado de mantenimiento. Filtra por plataforma con ?platform=web|mobile.
 *
 * Lee con la ANON key (las tres tablas tienen lectura pública por RLS): no
 * necesita la service role. Sin Supabase configurado devuelve valores por
 * defecto. Caché corta en CDN porque es igual para todos.
 *
 * Ejemplo (mobile): GET /api/config?platform=mobile
 */

const PLATAFORMAS = new Set(['all', 'web', 'mobile'])
const CACHE = 'public, max-age=30, s-maxage=30, stale-while-revalidate=60'

interface Mantenimiento {
  enabled: boolean
  message?: string
}

function porDefecto(): Response {
  return Response.json(
    { flags: {}, announcements: [], maintenance: { enabled: false } },
    { headers: { 'Cache-Control': CACHE } }
  )
}

export async function GET(request: Request): Promise<Response> {
  const pedido = new URL(request.url).searchParams.get('platform') ?? 'all'
  const platform = PLATAFORMAS.has(pedido) ? pedido : 'all'

  if (!isSupabaseConfigured()) return porDefecto()

  const client = createClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL'] as string,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] as string,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const nowIso = new Date().toISOString()
  const [flagsRes, annRes, settingsRes] = await Promise.all([
    client.from('feature_flags').select('key, enabled, value, platform'),
    client
      .from('announcements')
      .select('id, title, body, level, platform, starts_at, ends_at')
      .eq('active', true)
      .limit(20),
    client
      .from('app_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .maybeSingle(),
  ])

  const matches = (p: string) =>
    p === 'all' || platform === 'all' || p === platform

  const flags: Record<string, { enabled: boolean; value: unknown }> = {}
  for (const f of (flagsRes.data ?? []) as {
    key: string
    enabled: boolean
    value: unknown
    platform: string
  }[]) {
    if (matches(f.platform))
      flags[f.key] = { enabled: f.enabled, value: f.value }
  }

  const announcements = (
    (annRes.data ?? []) as {
      id: string
      title: string
      body: string
      level: string
      platform: string
      starts_at: string
      ends_at: string | null
    }[]
  )
    .filter((a) => matches(a.platform))
    .filter((a) => a.starts_at <= nowIso && (!a.ends_at || a.ends_at >= nowIso))
    .map(({ id, title, body, level }) => ({ id, title, body, level }))

  const valor = (settingsRes.data as { value: unknown } | null)?.value
  const crudo =
    typeof valor === 'object' && valor !== null
      ? (valor as Record<string, unknown>)
      : {}
  const maintenance: Mantenimiento = { enabled: crudo['enabled'] === true }
  if (typeof crudo['message'] === 'string') {
    maintenance.message = crudo['message'].slice(0, 500)
  }

  return Response.json(
    { flags, announcements, maintenance },
    { headers: { 'Cache-Control': CACHE } }
  )
}
