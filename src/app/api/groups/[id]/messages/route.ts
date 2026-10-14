import { z } from 'zod'
import { exigirMiembro } from '../../_lib/grupo'
import {
  autenticar,
  errorDb,
  errorJson,
  leerJson,
  nombreVisible,
  okJson,
} from '@/app/api/trips/_lib/http'
import { quitarControl } from '@/app/api/trips/_lib/texto'
import { rateLimit, tooManyRequests } from '@/lib/security/rateLimit'
import type { GroupMessageRow } from '@/types/database'

type Ctx = { params: Promise<{ id: string }> }

const LIMITE_MENSAJES = 100

// 'sistema' lo reserva el servidor (la RLS tampoco deja insertarlo).
const MessageSchema = z.object({
  mensaje: z.string().trim().min(1).max(1000),
  tipo: z.enum(['mensaje', 'alerta']).default('mensaje'),
})

/**
 * GET /api/groups/[tripId]/messages — los últimos 100 mensajes, en orden
 * cronológico. Respuesta: { messages: GroupMessageRow[] }
 */
export async function GET(
  request: Request,
  { params }: Ctx
): Promise<Response> {
  const { id } = await params

  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const rechazo = await exigirMiembro(supabase, id)
  if (rechazo) return rechazo

  // Los más recientes primero (para no quedarnos con los 100 más viejos) y
  // luego se invierten para mostrarlos en orden.
  const { data, error } = await supabase
    .from('group_messages')
    .select('*')
    .eq('trip_id', id)
    .order('created_at', { ascending: false })
    .limit(LIMITE_MENSAJES)

  if (error) return errorDb(error, 'groups.messages.list')
  const messages = ((data ?? []) as GroupMessageRow[]).reverse()
  return okJson({ messages })
}

/**
 * POST /api/groups/[tripId]/messages — envía un mensaje al chat del grupo.
 * Body: { mensaje: string, tipo?: 'mensaje' | 'alerta' }
 * Respuesta 201: { message: GroupMessageRow }
 */
export async function POST(
  request: Request,
  { params }: Ctx
): Promise<Response> {
  const { id } = await params

  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const limite = await rateLimit({
    bucket: 'group-message',
    id: user.id,
    limit: 30,
    windowSec: 60,
  })
  if (!limite.ok) return tooManyRequests(limite)

  const leido = await leerJson(request, 8_000)
  if (!leido.ok) return leido.response
  const parsed = MessageSchema.safeParse(leido.body)
  if (!parsed.success) {
    return errorJson(
      400,
      'El mensaje no puede estar vacío ni pasar de 1000 caracteres.',
      'invalid_message'
    )
  }

  const rechazo = await exigirMiembro(supabase, id)
  if (rechazo) return rechazo

  const { data, error } = await supabase
    .from('group_messages')
    .insert({
      trip_id: id,
      user_id: user.id,
      nombre_usuario: nombreVisible(user),
      mensaje: quitarControl(parsed.data.mensaje),
      tipo: parsed.data.tipo,
    })
    .select()
    .single()

  if (error || !data) return errorDb(error, 'groups.messages.insert')
  return okJson({ message: data as GroupMessageRow }, 201)
}
