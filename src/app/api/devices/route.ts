import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Schema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
})

/**
 * Registra el token de notificaciones push de un dispositivo (mobile/web).
 * El admin podrá usar estos tokens para enviar push masivos en el futuro.
 */
export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body: unknown = await request.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { error } = await supabase.from('device_tokens').upsert(
    {
      user_id: user.id,
      token: parsed.data.token,
      platform: parsed.data.platform,
    },
    { onConflict: 'token' }
  )
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
