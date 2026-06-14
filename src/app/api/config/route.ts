import { createAdminClientSafe } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Remote config para web y mobile. Devuelve feature flags, anuncios activos y
 * el estado de mantenimiento. Filtra por plataforma con ?platform=web|mobile.
 *
 * Ejemplo (mobile): GET /api/config?platform=mobile
 */
export async function GET(request: Request): Promise<Response> {
  const platform = new URL(request.url).searchParams.get('platform') ?? 'all'
  const client = createAdminClientSafe()
  if (!client) {
    return Response.json({
      flags: {},
      announcements: [],
      maintenance: { enabled: false },
    })
  }

  const nowIso = new Date().toISOString()
  const [flagsRes, annRes, settingsRes] = await Promise.all([
    client.from('feature_flags').select('key, enabled, value, platform'),
    client
      .from('announcements')
      .select('id, title, body, level, platform, starts_at, ends_at')
      .eq('active', true),
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

  const maintenance = (
    settingsRes.data as {
      value: { enabled?: boolean; message?: string }
    } | null
  )?.value ?? { enabled: false }

  return Response.json({ flags, announcements, maintenance })
}
