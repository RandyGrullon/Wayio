import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { esUuid, registrarError } from '@/app/api/trips/_lib/http'
import { trackServerEvent } from '@/lib/analytics/posthog'
import { esDeTienda, tierEfectivo } from '@/lib/stripe/entitlements'
import { tierDePlan } from '@/lib/stripe/plans'
import { tieneRecurrenteActiva } from '@/lib/stripe/suscripcion'
import type { PlanKey } from '@/constants/pricing'
import type {
  StoreEnvironment,
  SubscriptionRow,
  SubscriptionSource,
} from '@/types/database'
import { DIAS_PASE_TIENDA, entitlementPro, planDeProducto } from './productos'

/**
 * Eventos del webhook de RevenueCat → fila de subscriptions del usuario.
 *
 * - El usuario es el `app_user_id` (la app llama a Purchases.logIn con el id
 *   de Supabase). Nunca se compra con un id anónimo.
 * - Solo se gestionan las compras de App Store y Google Play (source
 *   'app_store' / 'play_store'); el resto de tiendas se ignora.
 * - Fuera de orden: un evento de la misma compra con una caducidad anterior
 *   a la guardada no la acorta, y una caducidad, cancelación o problema de
 *   cobro de OTRA compra (transacción original distinta) no toca la vigente.
 * - No pisa una suscripción de Stripe activa (la web): se registra y se deja.
 * - Lanza ante errores de BD para que la ruta responda 500 y RevenueCat
 *   reintente; lo que reintentar no arreglaría se ignora con un motivo.
 */

const DIA_MS = 86_400_000

const evento = z.object({
  id: z.string().min(1).max(200),
  type: z.string().min(1).max(80),
  app_user_id: z.string().nullish(),
  original_app_user_id: z.string().nullish(),
  aliases: z.array(z.string()).nullish(),
  product_id: z.string().nullish(),
  entitlement_ids: z.array(z.string()).nullish(),
  period_type: z.string().nullish(),
  purchased_at_ms: z.number().nullish(),
  expiration_at_ms: z.number().nullish(),
  environment: z.string().nullish(),
  store: z.string().nullish(),
  transaction_id: z.string().nullish(),
  original_transaction_id: z.string().nullish(),
  cancel_reason: z.string().nullish(),
  transferred_from: z.array(z.string()).nullish(),
  transferred_to: z.array(z.string()).nullish(),
})

export type EventoRevenueCat = z.infer<typeof evento>

/** Cuerpo del webhook ({ api_version, event }) → evento, o null si no vale. */
export function leerEvento(cuerpo: unknown): EventoRevenueCat | null {
  const r = z.object({ event: evento }).safeParse(cuerpo)
  return r.success ? r.data.event : null
}

export interface Resultado {
  estado: 'aplicado' | 'ignorado'
  motivo: string
  userId?: string
}

type FuenteTienda = Extract<SubscriptionSource, 'app_store' | 'play_store'>
type Fila = Partial<SubscriptionRow> & { user_id: string }

const aplicado = (motivo: string, userId?: string): Resultado => ({
  estado: 'aplicado',
  motivo,
  ...(userId ? { userId } : {}),
})
const ignorado = (motivo: string, userId?: string): Resultado => ({
  estado: 'ignorado',
  motivo,
  ...(userId ? { userId } : {}),
})

/** Usuario que no existe (FK): reintentar no lo arreglará. */
class SinCuenta extends Error {}

function fallo(
  contexto: string,
  error: { code?: string; message?: string }
): Error {
  if (error.code === '23503') return new SinCuenta(contexto)
  return new Error(
    `${contexto}: ${error.code ?? ''} ${error.message ?? ''}`.trim()
  )
}

function fuenteDe(store: string | null | undefined): FuenteTienda | null {
  if (store === 'APP_STORE' || store === 'MAC_APP_STORE') return 'app_store'
  if (store === 'PLAY_STORE') return 'play_store'
  return null
}

function entornoDe(env: string | null | undefined): StoreEnvironment | null {
  return env === 'SANDBOX' || env === 'PRODUCTION' ? env : null
}

/** Primer id de Supabase (uuid) entre los ids del evento. */
function usuarioDe(ev: EventoRevenueCat): string | null {
  const ids = [ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? [])]
  return ids.find((id) => esUuid(id)) ?? null
}

/** Transacción ORIGINAL (igual en cada renovación) o la de la compra. */
function transaccionDe(ev: EventoRevenueCat): string | null {
  return ev.original_transaction_id || ev.transaction_id || null
}

const iso = (ms: number): string => new Date(ms).toISOString()

function msDe(fecha: string | null | undefined): number {
  const t = fecha ? Date.parse(fecha) : Number.NaN
  return Number.isFinite(t) ? t : 0
}

const conAcceso = (status: string | null | undefined): boolean =>
  status === 'active' || status === 'trialing' || status === 'past_due'

/** ¿El evento es de la compra guardada en la fila (misma transacción)? */
function esLaVigente(fila: SubscriptionRow | null, tx: string | null) {
  return Boolean(
    fila && esDeTienda(fila.source) && tx && fila.store_transaction_id === tx
  )
}

function trackSeguro(
  userId: string,
  event: string,
  properties: Record<string, unknown>
): void {
  if (!process.env['NEXT_PUBLIC_POSTHOG_KEY']) return
  try {
    trackServerEvent(userId, event, properties)
  } catch {
    // la analítica nunca debe tumbar el webhook
  }
}

// ---------------------------------------------------------------------------
// Lectura y escritura
// ---------------------------------------------------------------------------

async function leerFila(
  admin: SupabaseClient,
  userId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw fallo('leer suscripción', error)
  return (data as SubscriptionRow | null) ?? null
}

/** Upsert por user_id (crea la fila si la cuenta no tenía). */
async function guardar(admin: SupabaseClient, fila: Fila): Promise<void> {
  const { error } = await admin
    .from('subscriptions')
    .upsert(fila, { onConflict: 'user_id' })
  if (error) throw fallo('guardar suscripción', error)
}

/** Cambia algunos campos de una fila que ya existe. */
async function actualizar(
  admin: SupabaseClient,
  userId: string,
  cambios: Partial<SubscriptionRow>
): Promise<void> {
  const { error } = await admin
    .from('subscriptions')
    .update(cambios)
    .eq('user_id', userId)
  if (error) throw fallo('actualizar suscripción', error)
}

// ---------------------------------------------------------------------------
// Plan del evento
// ---------------------------------------------------------------------------

/**
 * Plan por el producto (REVENUECAT_PRODUCTOS_*). Si no está en el catálogo,
 * se deduce del evento para que funcione con cualquier id de las tiendas:
 * compra no renovable o plan prepago = pase; si no, por la duración (más de
 * 100 días = anual). Se avisa para añadirlo a la variable. Un producto con
 * entitlements que no incluyen el de Pro no es de Wayio Pro: se ignora.
 */
function planDelEvento(ev: EventoRevenueCat): PlanKey | null {
  const plan = planDeProducto(ev.product_id ?? null)
  if (plan) return plan
  const entitlements = ev.entitlement_ids ?? []
  if (entitlements.length > 0 && !entitlements.includes(entitlementPro())) {
    return null
  }
  registrarError(
    'revenuecat.webhook',
    `producto ${ev.product_id ?? '-'} sin plan configurado: se deduce del evento (añádelo a REVENUECAT_PRODUCTOS_*)`
  )
  if (ev.type === 'NON_RENEWING_PURCHASE' || ev.period_type === 'PREPAID') {
    return 'pro_por_viaje'
  }
  const duracion =
    (ev.expiration_at_ms ?? 0) - (ev.purchased_at_ms ?? Date.now())
  return duracion > 100 * DIA_MS ? 'pro_anual' : 'pro_mensual'
}

/** Duración de respaldo si el evento no trae caducidad. */
function diasDe(plan: PlanKey): number {
  if (plan === 'pro_anual') return 366
  if (plan === 'pro_por_viaje') return DIAS_PASE_TIENDA
  return 31
}

/** Campos de la tienda comunes a toda escritura completa. */
function datosTienda(ev: EventoRevenueCat, fuente: FuenteTienda) {
  return {
    source: fuente,
    store_product_id: ev.product_id ?? null,
    store_transaction_id: transaccionDe(ev),
    store_environment: entornoDe(ev.environment),
    // El plan ya no es de Stripe: así un evento viejo de Stripe no lo pisa
    // (el webhook de Stripe respeta un plan vigente sin suscripción).
    stripe_subscription_id: null,
    stripe_price_id: null,
  }
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

/** Compra, renovación, reactivación, extensión… de una suscripción. */
async function darAcceso(
  admin: SupabaseClient,
  ev: EventoRevenueCat,
  userId: string,
  fuente: FuenteTienda
): Promise<Resultado> {
  const plan = planDelEvento(ev)
  if (!plan) return ignorado('producto sin el entitlement pro', userId)

  const actual = await leerFila(admin, userId)
  if (tieneRecurrenteActiva(actual)) {
    registrarError(
      'revenuecat.webhook',
      `${ev.type} de ${userId} con suscripción de Stripe activa: plan sin cambios`
    )
    return ignorado('ya paga una suscripción de Stripe', userId)
  }

  const tx = transaccionDe(ev)
  let fin =
    ev.expiration_at_ms ??
    (ev.purchased_at_ms ?? Date.now()) + diasDe(plan) * DIA_MS
  // Un evento viejo de la misma compra no acorta el periodo ya guardado.
  if (actual && esLaVigente(actual, tx) && conAcceso(actual.status)) {
    fin = Math.max(fin, msDe(actual.current_period_end))
  }

  await guardar(admin, {
    user_id: userId,
    plan_id: plan,
    tier: tierDePlan(plan),
    status: ev.period_type === 'TRIAL' ? 'trialing' : 'active',
    current_period_end: iso(fin),
    cancel_at_period_end: false,
    ...datosTienda(ev, fuente),
  })
  if (ev.type === 'INITIAL_PURCHASE') {
    trackSeguro(userId, 'pro_converted', { planId: plan, origen: fuente })
  }
  return aplicado(`${plan} hasta ${iso(fin)}`, userId)
}

/** Pase Pro de 30 días (compra que no se renueva). */
async function activarPase(
  admin: SupabaseClient,
  ev: EventoRevenueCat,
  userId: string,
  fuente: FuenteTienda
): Promise<Resultado> {
  const plan = planDelEvento(ev)
  if (!plan) return ignorado('producto sin el entitlement pro', userId)
  if (plan !== 'pro_por_viaje') return darAcceso(admin, ev, userId, fuente)

  const actual = await leerFila(admin, userId)
  const recurrenteDeTienda =
    actual !== null &&
    esDeTienda(actual.source) &&
    actual.plan_id !== 'pro_por_viaje' &&
    tierEfectivo(actual) !== 'free'
  if (tieneRecurrenteActiva(actual) || recurrenteDeTienda) {
    registrarError(
      'revenuecat.webhook',
      `pase de ${userId} con una suscripción activa: plan sin cambios`
    )
    return ignorado('ya tiene una suscripción activa', userId)
  }

  // 30 días desde la compra; otro pase vigente no se acorta (como en Stripe).
  let fin = (ev.purchased_at_ms ?? Date.now()) + DIAS_PASE_TIENDA * DIA_MS
  if (actual?.plan_id === 'pro_por_viaje' && tierEfectivo(actual) !== 'free') {
    fin = Math.max(fin, msDe(actual.current_period_end))
  }

  await guardar(admin, {
    user_id: userId,
    plan_id: 'pro_por_viaje',
    tier: 'pro',
    status: 'active',
    current_period_end: iso(fin),
    cancel_at_period_end: false,
    ...datosTienda(ev, fuente),
  })
  trackSeguro(userId, 'pro_converted', {
    planId: 'pro_por_viaje',
    origen: fuente,
  })
  return aplicado(`pro_por_viaje hasta ${iso(fin)}`, userId)
}

/**
 * Cancelación: no renovará y conserva el acceso hasta el fin del periodo.
 * Con `cancel_reason` CUSTOMER_SUPPORT es un reembolso: se quita al momento.
 */
async function cancelar(
  admin: SupabaseClient,
  ev: EventoRevenueCat,
  userId: string
): Promise<Resultado> {
  const actual = await leerFila(admin, userId)
  if (!esLaVigente(actual, transaccionDe(ev))) {
    return ignorado('no es la compra vigente', userId)
  }
  if (ev.cancel_reason === 'CUSTOMER_SUPPORT') {
    await actualizar(admin, userId, {
      plan_id: 'free',
      tier: 'free',
      status: 'canceled',
      cancel_at_period_end: false,
      current_period_end: iso(ev.expiration_at_ms ?? Date.now()),
    })
    return aplicado('reembolso: plan retirado', userId)
  }
  const fin = Math.max(
    ev.expiration_at_ms ?? 0,
    msDe(actual?.current_period_end)
  )
  await actualizar(admin, userId, {
    cancel_at_period_end: true,
    ...(fin > 0 ? { current_period_end: iso(fin) } : {}),
  })
  return aplicado('cancelada al final del periodo', userId)
}

/** Caducidad: se acabó el acceso (salvo que ya haya un periodo posterior). */
async function caducar(
  admin: SupabaseClient,
  ev: EventoRevenueCat,
  userId: string
): Promise<Resultado> {
  const actual = await leerFila(admin, userId)
  if (!esLaVigente(actual, transaccionDe(ev))) {
    return ignorado('no es la compra vigente', userId)
  }
  const fin = ev.expiration_at_ms ?? Date.now()
  if (
    conAcceso(actual?.status) &&
    msDe(actual?.current_period_end) > fin + 60_000
  ) {
    return ignorado('ya hay un periodo posterior', userId)
  }
  await actualizar(admin, userId, {
    plan_id: 'free',
    tier: 'free',
    status: 'canceled',
    cancel_at_period_end: false,
    current_period_end: iso(fin),
  })
  return aplicado('caducada', userId)
}

/** Problema de cobro: conserva el acceso (periodo de gracia de la tienda). */
async function problemaDeCobro(
  admin: SupabaseClient,
  ev: EventoRevenueCat,
  userId: string
): Promise<Resultado> {
  const actual = await leerFila(admin, userId)
  if (!esLaVigente(actual, transaccionDe(ev))) {
    return ignorado('no es la compra vigente', userId)
  }
  const fin = Math.max(
    ev.expiration_at_ms ?? 0,
    msDe(actual?.current_period_end)
  )
  await actualizar(admin, userId, {
    status: 'past_due',
    ...(fin > 0 ? { current_period_end: iso(fin) } : {}),
  })
  return aplicado('problema de cobro', userId)
}

/**
 * Transferencia: la compra pasó a otra cuenta (restaurar compras con otra
 * cuenta de Wayio en el mismo Apple ID o cuenta de Google). Se copia la
 * compra a la cuenta de destino y después se quita de las de origen (en
 * este orden, para que un reintento a medias no pierda nada).
 */
async function transferir(
  admin: SupabaseClient,
  ev: EventoRevenueCat
): Promise<Resultado> {
  const destino = (ev.transferred_to ?? []).find((id) => esUuid(id)) ?? null
  const origenes = (ev.transferred_from ?? []).filter(
    (id) => esUuid(id) && id !== destino
  )

  const conCompra: SubscriptionRow[] = []
  for (const uid of origenes) {
    const fila = await leerFila(admin, uid)
    if (fila && esDeTienda(fila.source) && fila.store_transaction_id) {
      conCompra.push(fila)
    }
  }
  if (!destino) return ignorado('transferencia sin cuenta de Wayio de destino')
  const movida = conCompra.reduce<SubscriptionRow | null>(
    (mejor, f) =>
      !mejor || msDe(f.current_period_end) > msDe(mejor.current_period_end)
        ? f
        : mejor,
    null
  )
  if (!movida) {
    registrarError(
      'revenuecat.webhook',
      `transferencia a ${destino} sin compra guardada en origen: llegará con el próximo evento`
    )
    return ignorado('sin compra guardada que mover', destino)
  }

  const actual = await leerFila(admin, destino)
  if (tieneRecurrenteActiva(actual)) {
    registrarError(
      'revenuecat.webhook',
      `transferencia a ${destino} con suscripción de Stripe activa: plan sin cambios`
    )
  } else {
    await guardar(admin, {
      user_id: destino,
      plan_id: movida.plan_id,
      tier: movida.tier,
      status: movida.status,
      current_period_end: movida.current_period_end,
      cancel_at_period_end: movida.cancel_at_period_end,
      source: movida.source ?? 'app_store',
      store_product_id: movida.store_product_id ?? null,
      store_transaction_id: movida.store_transaction_id ?? null,
      store_environment: movida.store_environment ?? null,
      stripe_subscription_id: null,
      stripe_price_id: null,
    })
  }

  for (const fila of conCompra) {
    await actualizar(admin, fila.user_id, {
      plan_id: 'free',
      tier: 'free',
      status: 'canceled',
      cancel_at_period_end: false,
      store_product_id: null,
      store_transaction_id: null,
      store_environment: null,
    })
  }
  return aplicado(
    `compra movida de ${conCompra.length} cuenta(s) a ${destino}`,
    destino
  )
}

// ---------------------------------------------------------------------------
// Despacho
// ---------------------------------------------------------------------------

const DAN_ACCESO = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'REFUND_REVERSED',
])

/** Aplica un evento de RevenueCat a la BD. Lanza si hay que reintentar. */
export async function procesarEventoRevenueCat(
  admin: SupabaseClient,
  ev: EventoRevenueCat
): Promise<Resultado> {
  try {
    if (ev.type === 'TEST') return ignorado('evento de prueba')
    if (ev.type === 'TRANSFER') return await transferir(admin, ev)

    const despachable =
      DAN_ACCESO.has(ev.type) ||
      ev.type === 'NON_RENEWING_PURCHASE' ||
      ev.type === 'CANCELLATION' ||
      ev.type === 'EXPIRATION' ||
      ev.type === 'BILLING_ISSUE'
    // PRODUCT_CHANGE (el plan nuevo llega con la renovación),
    // SUBSCRIPTION_PAUSED (llega EXPIRATION al empezar la pausa) y el resto.
    if (!despachable) return ignorado(`${ev.type} no cambia el plan`)

    const fuente = fuenteDe(ev.store)
    if (!fuente)
      return ignorado(`tienda ${ev.store ?? '-'} no se gestiona aquí`)

    const userId = usuarioDe(ev)
    if (!userId) {
      registrarError(
        'revenuecat.webhook',
        `${ev.type} ${ev.id} sin un app_user_id de Wayio (¿compra anónima?)`
      )
      return ignorado('sin cuenta de Wayio')
    }

    if (DAN_ACCESO.has(ev.type)) {
      return await darAcceso(admin, ev, userId, fuente)
    }
    switch (ev.type) {
      case 'NON_RENEWING_PURCHASE':
        return await activarPase(admin, ev, userId, fuente)
      case 'CANCELLATION':
        return await cancelar(admin, ev, userId)
      case 'EXPIRATION':
        return await caducar(admin, ev, userId)
      default:
        return await problemaDeCobro(admin, ev, userId)
    }
  } catch (err) {
    if (err instanceof SinCuenta) {
      registrarError(
        'revenuecat.webhook',
        `${ev.type} ${ev.id}: la cuenta ya no existe`
      )
      return ignorado('la cuenta ya no existe')
    }
    throw err
  }
}
