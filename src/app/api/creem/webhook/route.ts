import { esFaltaDeEsquema, registrarError } from '@/app/api/trips/_lib/http'
import { isCreemWebhookConfigured } from '@/lib/pagos/creem/server'
import {
  EventoCreemSchema,
  firmaCreemValida,
  procesarEventoCreem,
  type EventoCreem,
} from '@/lib/pagos/creem/webhook'
import { createAdminClientSafe } from '@/lib/supabase/admin'

/**
 * POST /api/creem/webhook — eventos de Creem (firma `creem-signature`
 * verificada con CREEM_WEBHOOK_SECRET). Se registra en el panel de Creem
 * (Developers → Webhooks) como https://<dominio>/api/creem/webhook.
 *
 * Responde 500 si algo falla para que Creem REINTENTE (30 s, 5 min, 30 min,
 * 6 h); los eventos que no interesan reciben 200. Cada event.id se procesa
 * una sola vez (tabla payment_events, provider = 'creem'). La lógica está en
 * src/lib/pagos/creem/webhook.ts.
 *
 * Atiende la suscripción aunque el proveedor activo (PAYMENTS_PROVIDER) sea
 * Stripe: quien ya paga con Creem sigue al día si se cambia de proveedor.
 */

/** Tope del cuerpo: un evento real ocupa unos pocos KB. */
const MAX_BYTES = 256_000

export async function POST(request: Request): Promise<Response> {
  if (!isCreemWebhookConfigured()) {
    return Response.json({ error: 'webhook_unavailable' }, { status: 503 })
  }

  const firma = request.headers.get('creem-signature')
  if (!firma) {
    return Response.json({ error: 'missing_signature' }, { status: 400 })
  }

  const cuerpo = await request.text()
  if (cuerpo.length > MAX_BYTES) {
    return Response.json({ error: 'too_large' }, { status: 413 })
  }
  if (
    !firmaCreemValida(cuerpo, firma, process.env['CREEM_WEBHOOK_SECRET'] ?? '')
  ) {
    return Response.json({ error: 'invalid_signature' }, { status: 400 })
  }

  let evento: EventoCreem
  try {
    evento = EventoCreemSchema.parse(JSON.parse(cuerpo))
  } catch {
    // Firmado pero con otra forma: reintentar no lo arreglará.
    registrarError('creem.webhook', 'evento con formato desconocido')
    return Response.json({ received: true, ignored: true })
  }

  const admin = createAdminClientSafe()
  if (!admin) {
    // Sin service role no se puede escribir: 500 para que Creem reintente
    // cuando el servidor esté bien configurado.
    registrarError('creem.webhook', 'falta la service role de Supabase')
    return Response.json({ error: 'not_configured' }, { status: 500 })
  }

  // Idempotencia: si este evento ya se procesó, no se repite.
  const visto = await admin
    .from('payment_events')
    .select('id')
    .eq('provider', 'creem')
    .eq('id', evento.id)
    .maybeSingle()
  if (!visto.error && visto.data) {
    return Response.json({ received: true, duplicate: true })
  }

  try {
    await procesarEventoCreem(admin, evento)
  } catch (err) {
    registrarError(`creem.webhook ${evento.eventType} ${evento.id}`, err)
    return Response.json({ error: 'processing_failed' }, { status: 500 })
  }

  const marca = await admin
    .from('payment_events')
    .insert({ provider: 'creem', id: evento.id, type: evento.eventType })
  if (
    marca.error &&
    marca.error.code !== '23505' &&
    !esFaltaDeEsquema(marca.error)
  ) {
    registrarError('creem.webhook.idempotencia', marca.error)
  }

  return Response.json({ received: true })
}
