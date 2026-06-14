'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from './auth'
import { logAdminAction } from './audit'
import type { ActionResult, Platform } from '@/types/admin'

function planTier(planId: string): 'free' | 'pro' | 'grupo' {
  if (planId === 'pro_grupo') return 'grupo'
  if (planId === 'free') return 'free'
  return 'pro'
}

// ---------------------------------------------------------------------------
// USUARIOS
// ---------------------------------------------------------------------------

export async function setUserRole(
  userId: string,
  role: string
): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const normalized = role === 'admin' ? 'admin' : 'user'
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ role: normalized })
    .eq('id', userId)
  if (error) return { ok: false, error: error.message }
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
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ is_banned: banned })
    .eq('id', userId)
  if (error) return { ok: false, error: error.message }
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

export async function grantPlan(
  userId: string,
  planId: string
): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      plan_id: planId,
      tier: planTier(planId),
      status: 'active',
      cancel_at_period_end: false,
    },
    { onConflict: 'user_id' }
  )
  if (error) return { ok: false, error: error.message }
  await logAdminAction(ctx, 'grant_plan', 'user', userId, { planId })
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/subscriptions')
  return { ok: true }
}

export async function revokePlan(userId: string): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('subscriptions')
    .update({ plan_id: 'free', tier: 'free', status: 'canceled' })
    .eq('user_id', userId)
  if (error) return { ok: false, error: error.message }
  await logAdminAction(ctx, 'revoke_plan', 'user', userId)
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
  if (error) return { ok: false, error: error.message }
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
  if (error) return { ok: false, error: error.message }
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
  if (error) return { ok: false, error: error.message }
  await logAdminAction(ctx, 'set_trip_estado', 'trip', tripId, { estado })
  revalidatePath('/admin/trips')
  revalidatePath(`/admin/trips/${tripId}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// MODERACIÓN DE GRUPOS
// ---------------------------------------------------------------------------

export async function deleteMessage(messageId: string): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('group_messages')
    .delete()
    .eq('id', messageId)
  if (error) return { ok: false, error: error.message }
  await logAdminAction(ctx, 'delete_message', 'message', messageId)
  revalidatePath('/admin/groups')
  return { ok: true }
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('group_expenses')
    .delete()
    .eq('id', expenseId)
  if (error) return { ok: false, error: error.message }
  await logAdminAction(ctx, 'delete_expense', 'expense', expenseId)
  revalidatePath('/admin/groups')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// FEATURE FLAGS
// ---------------------------------------------------------------------------

export async function upsertFlag(input: {
  key: string
  enabled: boolean
  description: string
  platform: Platform
}): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const key = input.key.trim().toLowerCase().replace(/\s+/g, '_')
  if (!key) return { ok: false, error: 'La clave no puede estar vacía.' }
  const admin = createAdminClient()
  const { error } = await admin.from('feature_flags').upsert(
    {
      key,
      enabled: input.enabled,
      description: input.description || null,
      platform: input.platform,
      updated_by: ctx.userId,
    },
    { onConflict: 'key' }
  )
  if (error) return { ok: false, error: error.message }
  await logAdminAction(ctx, 'upsert_flag', 'flag', key, {
    enabled: input.enabled,
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
  if (error) return { ok: false, error: error.message }
  await logAdminAction(ctx, 'toggle_flag', 'flag', key, { enabled })
  revalidatePath('/admin/flags')
  return { ok: true }
}

export async function deleteFlag(key: string): Promise<ActionResult> {
  const ctx = await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('feature_flags').delete().eq('key', key)
  if (error) return { ok: false, error: error.message }
  await logAdminAction(ctx, 'delete_flag', 'flag', key)
  revalidatePath('/admin/flags')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// ANUNCIOS
// ---------------------------------------------------------------------------

export async function createAnnouncement(input: {
  title: string
  body: string
  level: 'info' | 'warning' | 'critical'
  platform: Platform
}): Promise<ActionResult> {
  const ctx = await requireAdmin()
  if (!input.title.trim() || !input.body.trim()) {
    return { ok: false, error: 'Título y cuerpo son obligatorios.' }
  }
  const admin = createAdminClient()
  const { error } = await admin.from('announcements').insert({
    title: input.title.trim(),
    body: input.body.trim(),
    level: input.level,
    platform: input.platform,
    active: true,
    created_by: ctx.userId,
  })
  if (error) return { ok: false, error: error.message }
  await logAdminAction(ctx, 'create_announcement', 'announcement', input.title)
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
  if (error) return { ok: false, error: error.message }
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
  if (error) return { ok: false, error: error.message }
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
  if (error) return { ok: false, error: error.message }
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
  if (error) return { ok: false, error: error.message }
  await logAdminAction(ctx, 'set_ai_provider', 'setting', 'ai_provider', {
    provider,
  })
  revalidatePath('/admin/settings')
  return { ok: true }
}
