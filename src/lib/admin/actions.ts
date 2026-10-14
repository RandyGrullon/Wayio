'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, isStripeConfigured } from '@/lib/stripe/server'
import { PLANS } from '@/constants/pricing'
import { requireAdmin } from './auth'
import { logAdminAction } from './audit'
import { mensajeError } from './errores'
import type { ActionResult, Platform } from '@/types/admin'

function planTier(planId: string): 'free' | 'pro' | 'grupo' {
  if (planId === 'pro_grupo') return 'grupo'
  if (planId === 'free') return 'free'
  return 'pro'
}

/** Códigos de error de Postgres/PostgREST de "falta la columna". */
function faltaColumna(code: string | undefined): boolean {
  return code === '42703' || code === 'PGRST204'
}

/** Fallo de una action con el mensaje amable del error de base de datos. */
function fallo(
  error: unknown,
  contexto: string,
  propios?: Parameters<typeof mensajeError>[2]
): ActionResult {
  return { ok: false, error: mensajeError(error, contexto, propios) }
}

// ---------------------------------------------------------------------------
// USUARIOS
// ---------------------------------------------------------------------------

export async function setUserRole(
  userId: string,
  role: string
): Promise<ActionResult> {
  const ctx = await requireAdmin()
  // La UI ya lo bloquea, pero la regla vive en el servidor: un admin no puede
  // quitarse el rol a sí mismo (podría quedarse el panel sin admins).
  if (userId === ctx.userId) {
    return { ok: false, error: 'No puedes cambiar el rol de tu propia cuenta.' }
  }
  const normalized = role === 'admin' ? 'admin' : 'user'
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ role: normalized })
    .eq('id', userId)
  if (error) return fallo(error, 'setUserRole')
  await logAdminAction(ctx, 'set_user_role', 'user', userId, {
    role: normalized,
  })
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { ok: true }
}

export async function setUserBanned(
  userId: string,
  banned: boolean
): Promise<ActionResult> {
  const ctx = await requireAdmin()
  if (userId === ctx.userId) {
    return {
      ok: false,
      error: banned
        ? 'No puedes banear tu propia cuenta.'
        : 'No puedes quitar el ban de tu propia cuenta.',
    }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ is_banned: banned })
    .eq('id', userId)
  if (error) return fallo(error, 'setUserBanned')
  // También bloquea el login en Supabase Auth (ban de 100 años / 'none')
  try {
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: banned ? '876000h' : 'none',
    })
  } catch {
    // si falla el ban a nivel auth, el flag is_banned igual quedó aplicado
  }
  await logAdminAction(ctx, banned ? 'ban_user' : 'unban_user', 'user', userId)
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { ok: true }
}

/**
 * Concede un plan a mano. Queda marcado con source='admin' para que NO cuente
 * en el MRR (no es un ingreso) y sin fecha de fin (hasta que se revoque).
 */
export async function grantPlan(
  userId: string,
  planId: string
): Promise<ActionResult> {
  const ctx = await requireAdmin()
  if (
    planId !== 'free' &&
    !Object.prototype.hasOwnProperty.call(PLANS, planId)
  ) {
    return { ok: false, error: `Plan desconocido: ${planId}` }
  }
  const admin = createAdminClient()
  const fila = {
    user_id: userId,
    plan_id: planId,
    tier: planTier(planId),
    status: 'active',
    current_period_end: null,
    cancel_at_period_end: false,
  }
  let { error } = await admin
    .from('subscriptions')
    .upsert({ ...fila, source: 'admin' }, { onConflict: 'user_id' })
  // Sin la migración (no existe la columna source) se guarda sin la marca.
  if (error && faltaColumna(error.code)) {
    ;({ error } = await admin
      .from('subscriptions')
      .upsert(fila, { onConflict: 'user_id' }))
  }
  if (error) {
    return fallo(error, 'grantPlan', {
      referencia: 'Esa cuenta ya no existe: recarga la lista de usuarios.',
    })
  }
  await logAdminAction(ctx, 'grant_plan', 'user', userId, { planId })
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/subscriptions')
  return { ok: true }
}

/**
 * Revoca el plan. Si el usuario tiene una suscripción en Stripe, PRIMERO se
 * cancela allí (si no, seguiría pagando sin tener Pro). Después el webhook
 * customer.subscription.deleted confirmará el estado.
 */
export async function revokePlan(userId: string): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()

  const { data: actual, error: errLectura } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (errLectura) return fallo(errLectura, 'revokePlan (lectura)')

  const subId =
    (actual as { stripe_subscription_id: string | null } | null)
      ?.stripe_subscription_id ?? null
  let canceladaEnStripe = false
  if (subId) {
    if (!isStripeConfigured()) {
      return {
        ok: false,
        error:
          'Este usuario paga con Stripe, pero Stripe no está configurado: cancela la suscripción en el panel de Stripe y vuelve a intentarlo.',
      }
    }
    const stripe = getStripe()
    try {
      await stripe.subscriptions.cancel(subId)
      canceladaEnStripe = true
    } catch (err) {
      const code = (err as { code?: string } | null)?.code
      // Ya no existe en Stripe, o ya estaba cancelada: se puede seguir con
      // la revocación local. Cualquier otro error: no se toca nada.
      let yaCancelada = code === 'resource_missing'
      if (!yaCancelada) {
        try {
          const sub = await stripe.subscriptions.retrieve(subId)
          yaCancelada = sub.status === 'canceled'
        } catch {
          yaCancelada = false
        }
      }
      if (!yaCancelada) {
        const msg = err instanceof Error ? err.message : 'error desconocido'
        return {
          ok: false,
          error: `No se pudo cancelar el cobro en Stripe (${msg}). No se cambió nada.`,
        }
      }
    }
  }

  const { error } = await admin
    .from('subscriptions')
    .update({
      plan_id: 'free',
      tier: 'free',
      status: 'canceled',
      current_period_end: null,
      cancel_at_period_end: false,
    })
    .eq('user_id', userId)
  if (error) return fallo(error, 'revokePlan')
  await logAdminAction(ctx, 'revoke_plan', 'user', userId, {
    stripeSubscriptionId: subId,
    canceladaEnStripe,
  })
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/subscriptions')
  return { ok: true }
}

export async function deleteUserAccount(userId: string): Promise<ActionResult> {
  const ctx = await requireAdmin()
  if (userId === ctx.userId) {
    return { ok: false, error: 'No puedes eliminar tu propia cuenta de admin.' }
  }
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    return fallo(error, 'deleteUserAccount', {
      'no-encontrado': 'Esa cuenta ya no existe: puede que ya se haya borrado.',
    })
  }
  await logAdminAction(ctx, 'delete_user', 'user', userId)
  revalidatePath('/admin/users')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// VIAJES
// ---------------------------------------------------------------------------

export async function deleteTrip(tripId: string): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('trips').delete().eq('id', tripId)
  if (error) return fallo(error, 'deleteTrip')
  await logAdminAction(ctx, 'delete_trip', 'trip', tripId)
  revalidatePath('/admin/trips')
  return { ok: true }
}

export async function setTripEstado(
  tripId: string,
  estado: string
): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('trips')
    .update({ estado })
    .eq('id', tripId)
  if (error) return fallo(error, 'setTripEstado')
  await logAdminAction(ctx, 'set_trip_estado', 'trip', tripId, { estado })
  revalidatePath('/admin/trips')
  revalidatePath(`/admin/trips/${tripId}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// MODERACIÓN DE GRUPOS
// ---------------------------------------------------------------------------

/** trip_id de la fila borrada (delete … returning), si la había. */
function viajeBorrado(data: unknown): string | null {
  const filas = Array.isArray(data) ? (data as { trip_id?: unknown }[]) : []
  const tripId = filas[0]?.trip_id
  return typeof tripId === 'string' ? tripId : null
}

export async function deleteMessage(messageId: string): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()
  // .select() devuelve la fila borrada: así se sabe de qué viaje era y se
  // revalida también su ficha (/admin/trips/[id], pestaña Chat).
  const { data, error } = await admin
    .from('group_messages')
    .delete()
    .eq('id', messageId)
    .select('trip_id')
  if (error) return fallo(error, 'deleteMessage')
  const tripId = viajeBorrado(data)
  await logAdminAction(
    ctx,
    'delete_message',
    'message',
    messageId,
    tripId ? { tripId } : {}
  )
  revalidatePath('/admin/groups')
  if (tripId) revalidatePath(`/admin/trips/${tripId}`)
  return { ok: true }
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('group_expenses')
    .delete()
    .eq('id', expenseId)
    .select('trip_id')
  if (error) return fallo(error, 'deleteExpense')
  const tripId = viajeBorrado(data)
  await logAdminAction(
    ctx,
    'delete_expense',
    'expense',
    expenseId,
    tripId ? { tripId } : {}
  )
  revalidatePath('/admin/groups')
  if (tripId) revalidatePath(`/admin/trips/${tripId}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// FEATURE FLAGS
// ---------------------------------------------------------------------------

/** Tope del valor JSON de una función (texto serializado). */
const MAX_VALOR_FLAG = 10_000

function esObjetoPlano(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  const proto = Object.getPrototypeOf(v) as unknown
  return proto === Object.prototype || proto === null
}

export async function upsertFlag(input: {
  key: string
  enabled: boolean
  description: string
  platform: Platform
  /**
   * Valor JSON (un objeto). Sin él, al crear queda {} y al editar se
   * conserva el que tenía.
   */
  value?: unknown
}): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const key = input.key.trim().toLowerCase().replace(/\s+/g, '_')
  if (!key) return { ok: false, error: 'La clave no puede estar vacía.' }
  if (!/^[a-z0-9_.-]+$/.test(key)) {
    return {
      ok: false,
      error:
        'La clave solo admite minúsculas, números, puntos, guiones y guiones bajos.',
    }
  }
  const conValor = input.value !== undefined
  if (conValor) {
    if (!esObjetoPlano(input.value)) {
      return {
        ok: false,
        error:
          'El valor debe ser un objeto JSON entre llaves, por ejemplo {"porcentaje": 20}.',
      }
    }
    if (JSON.stringify(input.value).length > MAX_VALOR_FLAG) {
      return {
        ok: false,
        error: 'El valor es demasiado grande: máximo 10,000 caracteres.',
      }
    }
  }
  const admin = createAdminClient()
  const { error } = await admin.from('feature_flags').upsert(
    {
      key,
      enabled: input.enabled,
      description: input.description || null,
      platform: input.platform,
      ...(conValor ? { value: input.value } : {}),
      updated_by: ctx.userId,
    },
    { onConflict: 'key' }
  )
  if (error) {
    return fallo(error, 'upsertFlag', {
      duplicado: 'Ya existe una función con esa clave.',
    })
  }
  await logAdminAction(ctx, 'upsert_flag', 'flag', key, {
    enabled: input.enabled,
    ...(conValor ? { value: input.value } : {}),
  })
  revalidatePath('/admin/flags')
  return { ok: true }
}

export async function toggleFlag(
  key: string,
  enabled: boolean
): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('feature_flags')
    .update({ enabled, updated_by: ctx.userId })
    .eq('key', key)
  if (error) return fallo(error, 'toggleFlag')
  await logAdminAction(ctx, 'toggle_flag', 'flag', key, { enabled })
  revalidatePath('/admin/flags')
  return { ok: true }
}

export async function deleteFlag(key: string): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('feature_flags').delete().eq('key', key)
  if (error) return fallo(error, 'deleteFlag')
  await logAdminAction(ctx, 'delete_flag', 'flag', key)
  revalidatePath('/admin/flags')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// ANUNCIOS
// ---------------------------------------------------------------------------

/** Instante ISO opcional: null si viene vacío, 'invalido' si no se entiende. */
function leerInstante(
  valor: string | null | undefined
): string | null | 'invalido' {
  if (valor === null || valor === undefined || valor.trim() === '') return null
  const ms = Date.parse(valor)
  return Number.isNaN(ms) ? 'invalido' : new Date(ms).toISOString()
}

export async function createAnnouncement(input: {
  title: string
  body: string
  level: 'info' | 'warning' | 'critical'
  platform: Platform
  /** Desde cuándo se muestra (ISO). Sin él, desde ya. */
  startsAt?: string | null | undefined
  /** Hasta cuándo (ISO). Sin él, hasta que se oculte a mano. */
  endsAt?: string | null | undefined
}): Promise<ActionResult> {
  const ctx = await requireAdmin()
  if (!input.title.trim() || !input.body.trim()) {
    return { ok: false, error: 'Título y cuerpo son obligatorios.' }
  }
  const inicio = leerInstante(input.startsAt)
  const fin = leerInstante(input.endsAt)
  if (inicio === 'invalido') {
    return { ok: false, error: 'La fecha de inicio no es válida.' }
  }
  if (fin === 'invalido') {
    return { ok: false, error: 'La fecha de fin no es válida.' }
  }
  if (fin && Date.parse(fin) < (inicio ? Date.parse(inicio) : Date.now())) {
    return {
      ok: false,
      error: inicio
        ? 'La fecha de fin debe ser igual o posterior a la de inicio.'
        : 'La fecha de fin ya pasó: elige una posterior a ahora.',
    }
  }
  const admin = createAdminClient()
  const { error } = await admin.from('announcements').insert({
    title: input.title.trim(),
    body: input.body.trim(),
    level: input.level,
    platform: input.platform,
    active: true,
    // Sin inicio, la columna toma now() (default de la tabla).
    ...(inicio ? { starts_at: inicio } : {}),
    ends_at: fin,
    created_by: ctx.userId,
  })
  if (error) return fallo(error, 'createAnnouncement')
  await logAdminAction(
    ctx,
    'create_announcement',
    'announcement',
    input.title,
    {
      ...(inicio ? { startsAt: inicio } : {}),
      ...(fin ? { endsAt: fin } : {}),
    }
  )
  revalidatePath('/admin/announcements')
  return { ok: true }
}

export async function setAnnouncementActive(
  id: string,
  active: boolean
): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('announcements')
    .update({ active })
    .eq('id', id)
  if (error) return fallo(error, 'setAnnouncementActive')
  await logAdminAction(ctx, 'set_announcement_active', 'announcement', id, {
    active,
  })
  revalidatePath('/admin/announcements')
  return { ok: true }
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('announcements').delete().eq('id', id)
  if (error) return fallo(error, 'deleteAnnouncement')
  await logAdminAction(ctx, 'delete_announcement', 'announcement', id)
  revalidatePath('/admin/announcements')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// SETTINGS GLOBALES
// ---------------------------------------------------------------------------

export async function setMaintenanceMode(
  enabled: boolean,
  message: string
): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('app_settings')
    .upsert(
      { key: 'maintenance_mode', value: { enabled, message } },
      { onConflict: 'key' }
    )
  if (error) return fallo(error, 'setMaintenanceMode')
  await logAdminAction(
    ctx,
    'set_maintenance_mode',
    'setting',
    'maintenance_mode',
    {
      enabled,
    }
  )
  revalidatePath('/admin/settings')
  return { ok: true }
}

export async function setAiProvider(
  provider: 'anthropic' | 'groq'
): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('app_settings')
    .upsert({ key: 'ai_provider', value: { provider } }, { onConflict: 'key' })
  if (error) return fallo(error, 'setAiProvider')
  await logAdminAction(ctx, 'set_ai_provider', 'setting', 'ai_provider', {
    provider,
  })
  revalidatePath('/admin/settings')
  return { ok: true }
}
