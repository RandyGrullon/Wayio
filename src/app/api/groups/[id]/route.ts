import { exigirMiembro, unirsePorLink } from '../_lib/grupo'
import { autenticar, errorDb, okJson } from '@/app/api/trips/_lib/http'
import { rateLimit, tooManyRequests } from '@/lib/security/rateLimit'
import type { TripMemberRow } from '@/types/database'

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/groups/[tripId] — miembros del viaje (solo para miembros).
 * Respuesta: { members: TripMemberRow[] }
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

  const { data, error } = await supabase
    .from('trip_members')
    .select('*')
    .eq('trip_id', id)
    .order('joined_at', { ascending: true })

  if (error) return errorDb(error, 'groups.members')
  return okJson({ members: (data ?? []) as TripMemberRow[] })
}

/**
 * POST /api/groups/[grupoLink] — COMPATIBILIDAD: aquí [id] es el enlace de
 * invitación, no el id del viaje. Delega en la misma lógica que
 * POST /api/groups/join/[link] (la ruta nueva que debe usar la UI).
 * Respuesta 200: { tripId: string, member: TripMemberRow | null }
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
    bucket: 'group-join',
    id: user.id,
    limit: 20,
    windowSec: 600,
  })
  if (!limite.ok) return tooManyRequests(limite)

  return unirsePorLink(supabase, user, id)
}
