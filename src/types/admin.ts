export type AdminRole = 'user' | 'admin'
export type Platform = 'all' | 'web' | 'mobile'

export type ActionResult = { ok: true } | { ok: false; error: string }

export interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  role: AdminRole
  is_banned: boolean
  created_at: string
  updated_at: string
}

export interface AiLogRow {
  id: string
  user_id: string | null
  provider: string
  model: string
  endpoint: string | null
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost_usd: number
  latency_ms: number
  success: boolean
  error: string | null
  created_at: string
}

export interface FeatureFlagRow {
  key: string
  enabled: boolean
  value: Record<string, unknown>
  description: string | null
  platform: Platform
  updated_at: string
  updated_by: string | null
}

export interface AnnouncementRow {
  id: string
  title: string
  body: string
  level: 'info' | 'warning' | 'critical'
  platform: Platform
  active: boolean
  starts_at: string
  ends_at: string | null
  created_at: string
  created_by: string | null
}

export interface DeviceTokenRow {
  id: string
  user_id: string
  token: string
  platform: 'ios' | 'android' | 'web'
  created_at: string
}

export interface AdminAuditRow {
  id: string
  admin_id: string | null
  admin_email: string | null
  action: string
  target_type: string | null
  target_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface AppSettingRow {
  key: string
  value: Record<string, unknown>
  updated_at: string
}
