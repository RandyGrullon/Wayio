import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  NO_STORE,
  UUID_RE,
  autenticar,
  campo,
  errorJson,
  leerJson,
  okJson,
  registrarError,
} from '@/app/api/trips/_lib/http'
import { PLANES_A_LA_VENTA } from '@/constants/planes'
import { checkoutPlanCreem } from '@/lib/pagos/creem/cobro'
import {
  cancelarSuscripcion,
  enlacePortal,
  reanudarSuscripcion,
} from '@/lib/pagos/creem/server'
import { sincronizarSuscripcionCreem } from '@/lib/pagos/creem/webhook'
import {
  proveedorActivo,
  proveedorConfigurado,
  proveedorDeFila,
  type ProveedorPago,
} from '@/lib/pagos/proveedor'
import {
  bajaAlFinalStripe,
  checkoutPlanStripe,
  checkoutReservaStripe,
  ctxStripe,
  portalStripe,
} from '@/lib/pagos/stripe/cobro'
import { rateLimit, tooManyRequests } from '@/lib/security/rateLimit'
import { esDeTienda, tierEfectivo } from '@/lib/stripe/entitlements'
import { esPagoUnico, esPlanKey } from '@/lib/stripe/plans'
import { getStripe, reservasHabilitadas } from '@/lib/stripe/server'
import {
  leerSuscripcion,
  tieneRecurrenteActiva,
} from '@/lib/stripe/suscripcion'
import { createAdminClientSafe } from '@/lib/supabase/admin'
import { getBaseUrl } from '@/lib/utils/baseUrl'
import type { SubscriptionRow } from '@/types/database'

/**
 * Rutas de cobro independientes del proveedor (Creem o Stripe, según
 * PAYMENTS_PROVIDER). Las usan /api/pagos/* y, por compatibilidad con las
 * versiones ya publicadas de la app móvil, /api/stripe/checkout y
 * /api/stripe/portal. Aceptan sesión por cookies (web) o Bearer (móvil).
 *
 * Ningún mensaje nombra al procesador: la UI de clientes habla de «el pago»
 * y «el portal de pagos».
 */

const PlanSchema = z.object({
  planId: z.string().max(40),
  tripId: z.string().regex(UUID_RE).optional(),
})

const AccionSchema = z.object({
  accion: z.enum(['cancelar', 'reanudar']),
})

function noDisponible(configurado = true): Response {
  return Response.json(
    {
      error: 'checkout_unavailable',
      mensaje: configurado
        ? 'Los pagos no están disponibles en este momento. Inténtalo de nuevo en unos minutos.'
        : 'Los pagos en línea todavía no están disponibles. Muy pronto podrás mejorar tu plan.',
      ...(configurado ? {} : { configured: false }),
    },
    { status: 503, headers: NO_STORE }
  )
}

function portalNoDisponible(configurado = true): Response {
  return Response.json(
    {
      error: 'checkout_unavailable',
      mensaje:
        'El portal de pagos no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
      ...(configurado ? {} : { configured: false }),
    },
    { status: 503, headers: NO_STORE }
  )
}

/** URL del portal de pagos del proveedor que cobra al cliente. */
async function urlPortal(
  proveedor: ProveedorPago,
  customerId: string,
  baseUrl: string
): Promise<string> {
  return proveedor === 'creem'
    ? enlacePortal(customerId)
    : portalStripe(getStripe(), customerId, baseUrl)
}

// ---------------------------------------------------------------------------
// POST /api/pagos/checkout
// ---------------------------------------------------------------------------

/**
 * Planes: { planId: 'pro_mensual'|'pro_anual'|'pro_por_viaje',
 *           tripId?: uuid (solo el pase: lo ajusta a las fechas del viaje) }
 *   → 200 { url }                         pago (vuelve a /cuenta?pago=ok)
 *   → 200 { url, portal: true, mensaje }   ya tiene suscripción: portal
 *   → 400 { code: 'plan_no_disponible' }   plan que existe pero no se vende
 *   → 409 { error, code: 'already_pro' }   plan concedido vigente
 * Reserva: { mode: 'reservation', tripId } (solo con Stripe y con
 *   NEXT_PUBLIC_RESERVAS_ENABLED=true; si no, 403 reservations_disabled).
 * Sin proveedor configurado o si falla: 503 { error: 'checkout_unavailable',
 *   mensaje, configured? }.
 */
export async function manejarCheckout(request: Request): Promise<Response> {
  const proveedor = proveedorActivo()
  if (!proveedorConfigurado(proveedor)) return noDisponible(false)

  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const limite = await rateLimit({
    bucket: 'pagos-checkout',
    id: user.id,
    limit: 10,
    windowSec: 600,
  })
  if (!limite.ok) return tooManyRequests(limite)

  const leido = await leerJson(request, 4_000)
  if (!leido.ok) return leido.response

  const baseUrl = getBaseUrl()
  try {
    if (campo(leido.body, 'mode') === 'reservation') {
      return await checkoutReserva(proveedor, supabase, user, leido.body)
    }
    return await checkoutPlan(proveedor, supabase, user, leido.body, baseUrl)
  } catch (err) {
    registrarError(`pagos.checkout.${proveedor}`, err)
    return noDisponible()
  }
}

async function checkoutReserva(
  proveedor: ProveedorPago,
  supabase: SupabaseClient,
  user: User,
  body: unknown
): Promise<Response> {
  // Un merchant of record (Creem) vende software, no depósitos de viajes de
  // terceros: las reservas solo existen con Stripe y apagadas por defecto.
  if (!reservasHabilitadas() || proveedor !== 'stripe') {
    return errorJson(
      403,
      'Las reservas en línea todavía no están disponibles. Te avisaremos en cuanto lo estén.',
      'reservations_disabled'
    )
  }
  const sub = await leerSuscripcion(supabase, user.id)
  return checkoutReservaStripe(
    ctxStripe(supabase, user, getBaseUrl()),
    body,
    sub,
    () => noDisponible()
  )
}

async function checkoutPlan(
  proveedor: ProveedorPago,
  supabase: SupabaseClient,
  user: User,
  body: unknown,
  baseUrl: string
): Promise<Response> {
  const parsed = PlanSchema.safeParse(body)
  const planId = parsed.success ? parsed.data.planId : null
  if (!parsed.success || !esPlanKey(planId)) {
    return errorJson(400, 'Elige un plan válido.', 'invalid_plan')
  }
  if (!PLANES_A_LA_VENTA.includes(planId)) {
    return errorJson(
      400,
      'Ese plan no está disponible por ahora.',
      'plan_no_disponible'
    )
  }

  const sub = await leerSuscripcion(supabase, user.id)

  // Ya paga una suscripción: no se abre otra, se le manda al portal del
  // proveedor que se la cobra (aunque ya no sea el activo).
  if (tieneRecurrenteActiva(sub)) {
    const suyo = proveedorDeFila(sub)
    const customerId = sub?.stripe_customer_id ?? null
    if (suyo && customerId && proveedorConfigurado(suyo)) {
      return okJson({
        url: await urlPortal(suyo, customerId, baseUrl),
        portal: true,
        mensaje:
          'Ya tienes una suscripción activa. Puedes cambiarla o cancelarla desde el portal de pagos.',
      })
    }
    return errorJson(
      409,
      'Ya tienes una suscripción activa. Puedes gestionarla desde Tu cuenta.',
      'already_pro'
    )
  }

  // Plan concedido a mano y vigente: no tiene sentido cobrarle.
  if (sub?.source === 'admin' && tierEfectivo(sub) !== 'free') {
    return errorJson(
      409,
      'Ya tienes Wayio Pro activo en tu cuenta.',
      'already_pro'
    )
  }

  // Ya paga Pro con la tienda de la app (App Store / Google Play): no se le
  // cobra dos veces; se gestiona desde la tienda.
  if (esDeTienda(sub?.source) && tierEfectivo(sub) !== 'free') {
    const tienda = sub?.source === 'app_store' ? 'App Store' : 'Google Play'
    return errorJson(
      409,
      `Ya tienes Wayio Pro con tu suscripción de ${tienda}. Gestiónala desde ${tienda} en tu teléfono.`,
      'already_pro'
    )
  }

  // Pase: si llega un tripId que es del usuario, el pase se ajusta a las
  // fechas de ese viaje (ver finPaseUnico).
  let tripId: string | null = null
  if (esPagoUnico(planId) && parsed.data.tripId) {
    const { data } = await supabase
      .from('trips')
      .select('id')
      .eq('id', parsed.data.tripId)
      .eq('user_id', user.id)
      .maybeSingle()
    tripId = data ? parsed.data.tripId : null
  }

  const url =
    proveedor === 'creem'
      ? await checkoutPlanCreem({ user, planId, tripId, sub, baseUrl })
      : await checkoutPlanStripe(ctxStripe(supabase, user, baseUrl), {
          planId,
          tripId,
          sub,
        })
  if (!url) return noDisponible()
  return okJson({ url })
}

// ---------------------------------------------------------------------------
// POST /api/pagos/portal
// ---------------------------------------------------------------------------

/**
 * Portal de pagos (método de pago, facturas, cancelar) del proveedor que
 * cobra al usuario. 200 { url } · 404 { code: 'no_customer' } si nunca pagó ·
 * 503 { error: 'checkout_unavailable', mensaje }.
 */
export async function manejarPortal(request: Request): Promise<Response> {
  if (!proveedorConfigurado('creem') && !proveedorConfigurado('stripe')) {
    return portalNoDisponible(false)
  }

  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const sub = await leerSuscripcion(supabase, user.id)
  const proveedor = proveedorDeFila(sub)
  const customerId = sub?.stripe_customer_id ?? null
  if (!proveedor || !customerId) {
    return errorJson(
      404,
      'Todavía no tienes pagos que gestionar.',
      'no_customer'
    )
  }
  if (!proveedorConfigurado(proveedor)) return portalNoDisponible()

  try {
    return okJson({ url: await urlPortal(proveedor, customerId, getBaseUrl()) })
  } catch (err) {
    registrarError(`pagos.portal.${proveedor}`, err)
    return portalNoDisponible()
  }
}

// ---------------------------------------------------------------------------
// POST /api/pagos/suscripcion
// ---------------------------------------------------------------------------

/**
 * { accion: 'cancelar' } programa la baja al FINAL del periodo pagado (sigue
 * con Pro hasta entonces); { accion: 'reanudar' } la deshace.
 *   → 200 { ok: true, cancelaAlFinal, finPeriodo }
 *   → 404 { code: 'no_subscription' } sin suscripción recurrente vigente
 *   → 503 { error: 'checkout_unavailable', mensaje }
 */
export async function manejarSuscripcion(request: Request): Promise<Response> {
  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const limite = await rateLimit({
    bucket: 'pagos-suscripcion',
    id: user.id,
    limit: 10,
    windowSec: 600,
  })
  if (!limite.ok) return tooManyRequests(limite)

  const leido = await leerJson(request, 1_000)
  if (!leido.ok) return leido.response
  const parsed = AccionSchema.safeParse(leido.body)
  if (!parsed.success) {
    return errorJson(400, 'Acción no válida.', 'invalid_action')
  }
  const cancelar = parsed.data.accion === 'cancelar'

  const sub = await leerSuscripcion(supabase, user.id)
  const subId = sub?.stripe_subscription_id ?? null
  if (!sub || !subId || !tieneRecurrenteActiva(sub)) {
    return errorJson(
      404,
      'No tienes una suscripción activa que cambiar.',
      'no_subscription'
    )
  }
  const respuesta = (fila: SubscriptionRow, cancelaAlFinal: boolean) =>
    okJson({
      ok: true,
      cancelaAlFinal,
      finPeriodo: fila.current_period_end,
    })
  // Ya está como pide: nada que hacer (doble clic, otra pestaña…).
  if (sub.cancel_at_period_end === cancelar) return respuesta(sub, cancelar)

  const proveedor = proveedorDeFila(sub)
  if (!proveedor || !proveedorConfigurado(proveedor)) {
    return portalNoDisponible()
  }

  try {
    const admin = createAdminClientSafe()
    if (proveedor === 'creem') {
      const actualizada = cancelar
        ? await cancelarSuscripcion(subId, 'scheduled')
        : await reanudarSuscripcion(subId)
      if (admin) {
        await sincronizarSuscripcionCreem(admin, actualizada, user.id)
      }
      const fila = admin ? await leerSuscripcion(admin, user.id) : null
      return respuesta(
        fila ?? sub,
        fila?.cancel_at_period_end ?? actualizada.status === 'scheduled_cancel'
      )
    }

    const { cancelAtPeriodEnd } = await bajaAlFinalStripe(subId, cancelar)
    if (admin) {
      const { error } = await admin
        .from('subscriptions')
        .update({ cancel_at_period_end: cancelAtPeriodEnd })
        .eq('user_id', user.id)
      if (error) registrarError('pagos.suscripcion.stripe', error)
    }
    return respuesta(sub, cancelAtPeriodEnd)
  } catch (err) {
    registrarError(`pagos.suscripcion.${proveedor}`, err)
    return Response.json(
      {
        error: 'checkout_unavailable',
        mensaje:
          'No pudimos cambiar tu suscripción ahora mismo. Inténtalo de nuevo en unos minutos.',
      },
      { status: 503, headers: NO_STORE }
    )
  }
}
