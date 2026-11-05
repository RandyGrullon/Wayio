import { createHash, timingSafeEqual } from 'node:crypto'
import { esFaltaDeEsquema, registrarError } from '@/app/api/trips/_lib/http'
import { leerEvento, procesarEventoRevenueCat } from '@/lib/revenuecat/eventos'
import { createAdminClientSafe } from '@/lib/supabase/admin'

/**
 * POST /api/revenuecat/webhook — compras integradas de la app (App Store y
 * Google Play) a través de RevenueCat.
 *
 * - Autorización: RevenueCat manda en `Authorization` el valor configurado en
 *   su panel (Integrations → Webhooks → Authorization header value). Se
 *   compara en tiempo constante con REVENUECAT_WEBHOOK_AUTH (se acepta el
 *   valor tal cual o con el prefijo «Bearer »). Sin la variable: 503.
 * - Escribe con la SERVICE ROLE (la petición no trae sesión de usuario).
 * - Idempotencia: cada event.id se procesa una vez (tabla revenuecat_events).
 * - Si algo falla responde 500 para que RevenueCat REINTENTE; lo que no
 *   interesa o no se puede asociar recibe 200 con el motivo.
 *
 * La lógica de cada evento está en src/lib/revenuecat/eventos.ts.
 */

/** Los eventos de RevenueCat pesan unos pocos KB. */
const MAX_BYTES = 64 * 1024

const sinCache = { 'Cache-Control': 'no-store' }

function resumen(texto: string): Buffer {
  return createHash('sha256').update(texto, 'utf8').digest()
}

/** ¿La cabecera Authorization es la acordada? (tiempo constante) */
function autorizado(cabecera: string | null, secreto: string): boolean {
  if (!cabecera) return false
  const recibido = cabecera.trim()
  const valor = recibido.toLowerCase().startsWith('bearer ')
    ? recibido.slice(7).trim()
    : recibido
  const esperado = secreto.toLowerCase().startsWith('bearer ')
    ? secreto.slice(7).trim()
    : secreto
  return timingSafeEqual(resumen(valor), resumen(esperado))
}

export async function POST(request: Request): Promise<Response> {
  const secreto = process.env['REVENUECAT_WEBHOOK_AUTH']?.trim()
  if (!secreto) {
    return Response.json(
      { error: 'webhook_unavailable' },
      { status: 503, headers: sinCache }
    )
  }
  if (!autorizado(request.headers.get('authorization'), secreto)) {
    return Response.json(
      { error: 'unauthorized' },
      { status: 401, headers: sinCache }
    )
  }

  const texto = await request.text()
  if (texto.length > MAX_BYTES) {
    return Response.json(
      { error: 'payload_too_large' },
      { status: 413, headers: sinCache }
    )
  }
  let cuerpo: unknown
  try {
    cuerpo = JSON.parse(texto)
  } catch {
    return Response.json(
      { error: 'invalid_json' },
      { status: 400, headers: sinCache }
    )
  }
  const evento = leerEvento(cuerpo)
  if (!evento) {
    return Response.json(
      { error: 'invalid_event' },
      { status: 400, headers: sinCache }
    )
  }

  const admin = createAdminClientSafe()
  if (!admin) {
    // Sin service role no se puede escribir: 500 para que RevenueCat
    // reintente cuando el servidor esté bien configurado.
    registrarError('revenuecat.webhook', 'falta la service role de Supabase')
    return Response.json(
      { error: 'not_configured' },
      { status: 500, headers: sinCache }
    )
  }

  // Idempotencia: si este evento ya se procesó, no se repite.
  const visto = await admin
    .from('revenuecat_events')
    .select('id')
    .eq('id', evento.id)
    .maybeSingle()
  if (!visto.error && visto.data) {
    return Response.json(
      { received: true, duplicate: true },
      { headers: sinCache }
    )
  }

  let resultado
  try {
    resultado = await procesarEventoRevenueCat(admin, evento)
  } catch (err) {
    registrarError(`revenuecat.webhook ${evento.type} ${evento.id}`, err)
    return Response.json(
      { error: 'processing_failed' },
      { status: 500, headers: sinCache }
    )
  }

  const marca = await admin.from('revenuecat_events').insert({
    id: evento.id,
    type: evento.type,
    app_user_id: evento.app_user_id ?? null,
    environment: evento.environment ?? null,
  })
  if (
    marca.error &&
    marca.error.code !== '23505' &&
    !esFaltaDeEsquema(marca.error)
  ) {
    registrarError('revenuecat.webhook.idempotencia', marca.error)
  }

  return Response.json({ received: true, ...resultado }, { headers: sinCache })
}
