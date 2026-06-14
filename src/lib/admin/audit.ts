import { createAdminClient } from '@/lib/supabase/admin'
import type { AdminContext } from './auth'

/** Registra una acción de admin en admin_audit_log (best-effort, no lanza). */
export async function logAdminAction(
  ctx: AdminContext,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('admin_audit_log').insert({
      admin_id: ctx.userId,
      admin_email: ctx.email,
      action,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      metadata,
    })
  } catch {
    // la auditoría es best-effort
  }
}
