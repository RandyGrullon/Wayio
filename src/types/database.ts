import type { Trip } from './trip'
import type { Activity } from './activity'
import type { PlanId, PlanTier } from './subscription'

/**
 * Filas de Supabase (snake_case, tal como las devuelve PostgREST). Reflejan
 * supabase/schema.sql. Los campos marcados como opcionales (`?`) existen a
 * partir de la migración 20261008120000_seguridad_y_flujos: en un proyecto que
 * todavía no la tiene aplicada pueden faltar.
 */

export interface TripRow {
  id: string
  user_id: string
  data: Trip
  paquete: 'basico' | 'confort' | 'premium'
  grupo_link: string | null
  /** El dueño lo marcó para la vista pública /viaje-compartido/<id>. */
  is_public?: boolean
  estado: 'planificando' | 'en_viaje' | 'completado'
  actividades_pendientes: Activity[]
  created_at: string
  updated_at: string
}

/** Lo que devuelve la RPC get_shared_trip (nunca grupo_link ni user_id). */
export interface SharedTripPayload {
  data: Trip
  destino: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
}

export interface TripMemberRow {
  id: string
  trip_id: string
  user_id: string
  nombre: string
  avatar_url: string | null
  lat_actual: number | null
  lng_actual: number | null
  ultima_ubicacion: string | null
  joined_at: string
}

export interface ActivityVoteRow {
  id: string
  trip_id: string
  activity_id: string
  user_id: string
  voto: boolean
  created_at: string
}

export interface GroupMessageRow {
  id: string
  trip_id: string
  user_id: string
  nombre_usuario: string
  mensaje: string
  tipo: 'mensaje' | 'sistema' | 'alerta'
  created_at: string
}

export interface GroupExpenseRow {
  id: string
  trip_id: string
  pagado_por: string
  nombre_pagador: string
  concepto: string
  monto: number
  entre_todos: boolean
  created_at: string
}

/** Estado de una actividad por usuario (sync offline de mobile). */
export type ActivityStateEstado =
  | 'pendiente'
  | 'en_curso'
  | 'completada'
  | 'perdida'
  | 'recuperada'

export interface ActivityStateRow {
  id: string
  trip_id: string
  activity_id: string
  user_id: string
  estado: ActivityStateEstado
  hora_entrada: string | null
  hora_salida: string | null
  updated_at: string
}

/**
 * Estados que admite la columna subscriptions.status. El webhook solo escribe
 * los 5 primeros (mapea el resto), pero el CHECK admite todos los de Stripe.
 */
export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'trialing'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused'

/**
 * De dónde viene el plan: alta gratuita, pago web con un proveedor de cobro
 * (Stripe o Creem), concedido a mano o compra integrada de la app (App Store
 * / Google Play vía RevenueCat).
 */
export type SubscriptionSource =
  | 'system'
  | 'stripe'
  | 'creem'
  | 'admin'
  | 'app_store'
  | 'play_store'

/** Entorno de la tienda de una compra integrada (SANDBOX = pruebas). */
export type StoreEnvironment = 'SANDBOX' | 'PRODUCTION'

export interface SubscriptionRow {
  id: string
  user_id: string
  plan_id: PlanId
  tier: PlanTier
  /**
   * Ids en el proveedor de cobro que indica `source` (nombre histórico: con
   * Creem guardan cust_…, sub_… y prod_…). La RPC my_effective_tier y la app
   * móvil leen stripe_subscription_id para saber si el plan es recurrente.
   */
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  status: SubscriptionStatus
  current_period_end: string | null
  cancel_at_period_end: boolean
  source?: SubscriptionSource
  /** Compras integradas: producto de la tienda (migración 20261105130000). */
  store_product_id?: string | null
  /** Compras integradas: transacción original (igual en cada renovación). */
  store_transaction_id?: string | null
  store_environment?: StoreEnvironment | null
  created_at: string
}

export interface ReferralRow {
  id: string
  user_id: string
  code: string
  conversions: number
  created_at: string
}

export interface ReferralRedemptionRow {
  referred_user_id: string
  referrer_id: string
  referral_id: string
  code: string
  created_at: string
}

/** Resultado de la RPC apply_referral. */
export type ApplyReferralResult =
  | 'ok'
  | 'not_authenticated'
  | 'invalid_code'
  | 'self_referral'
  | 'already_redeemed'
  | 'not_eligible'

export interface ReservationRow {
  id: string
  user_id: string
  trip_id: string | null
  /** En la unidad mínima de la moneda (centavos), como lo manda Stripe. */
  amount_total: number
  currency: string
  stripe_session_id: string
  stripe_payment_intent_id: string | null
  /** payment_status de la Checkout Session: paid | unpaid | failed... */
  payment_status: string
  created_at: string
  updated_at: string
}
