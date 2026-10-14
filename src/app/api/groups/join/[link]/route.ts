import { unirsePorLink } from '../../_lib/grupo'
import { autenticar } from '@/app/api/trips/_lib/http'
import { rateLimit, tooManyRequests } from '@/lib/security/rateLimit'

/**
 * POST /api/groups/join/[link] — unirse a un viaje en grupo con su enlace de
 * invitación (grupo_link). Valida el link en la BD (RPC join_trip) y da de
 * alta al usuario como miembro; es idempotente.
 *
 * Respuesta 200: { tripId: string, member: TripMemberRow | null }
 * Errores: 401 sin sesión, 404 link inválido, 403 cuenta bloqueada, 429.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ link: string }> }
): Promise<Response> {
  const { link } = await params

  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  // Freno a la prueba masiva de enlaces.
  const limite = await rateLimit({
    bucket: 'group-join',
    id: user.id,
    limit: 20,
    windowSec: 600,
  })
  if (!limite.ok) return tooManyRequests(limite)

  return unirsePorLink(supabase, user, link)
}
