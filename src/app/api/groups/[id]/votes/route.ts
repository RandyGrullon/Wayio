import { z } from 'zod'
import { exigirMiembro } from '../../_lib/grupo'
import {
  autenticar,
  errorDb,
  errorJson,
  leerJson,
  okJson,
} from '@/app/api/trips/_lib/http'
import { rateLimit, tooManyRequests } from '@/lib/security/rateLimit'
import type { ActivityVoteRow } from '@/types/database'

type Ctx = { params: Promise<{ id: string }> }

const VoteSchema = z.object({
  activity_id: z.string().trim().min(1).max(100),
  voto: z.boolean(),
})

/**
 * GET /api/groups/[tripId]/votes[?activityId=...]
 * Respuesta: { votes: ActivityVoteRow[] }
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

  const activityId = new URL(request.url).searchParams.get('activityId')

  let query = supabase.from('activity_votes').select('*').eq('trip_id', id)
  if (activityId) query = query.eq('activity_id', activityId.slice(0, 100))

  const { data, error } = await query
  if (error) return errorDb(error, 'groups.votes.list')
  return okJson({ votes: (data ?? []) as ActivityVoteRow[] })
}

/**
 * POST /api/groups/[tripId]/votes — vota (o cambia tu voto) una actividad.
 * Body: { activity_id: string, voto: boolean }
 * Respuesta: { vote: ActivityVoteRow }
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
    bucket: 'group-vote',
    id: user.id,
    limit: 60,
    windowSec: 60,
  })
  if (!limite.ok) return tooManyRequests(limite)

  const leido = await leerJson(request, 2_000)
  if (!leido.ok) return leido.response
  const parsed = VoteSchema.safeParse(leido.body)
  if (!parsed.success) {
    return errorJson(400, 'El voto no es válido.', 'invalid_vote')
  }

  const rechazo = await exigirMiembro(supabase, id)
  if (rechazo) return rechazo

  const { data, error } = await supabase
    .from('activity_votes')
    .upsert(
      {
        trip_id: id,
        activity_id: parsed.data.activity_id,
        user_id: user.id,
        voto: parsed.data.voto,
      },
      { onConflict: 'trip_id,activity_id,user_id' }
    )
    .select()
    .single()

  if (error || !data) return errorDb(error, 'groups.votes.upsert')
  return okJson({ vote: data as ActivityVoteRow })
}
