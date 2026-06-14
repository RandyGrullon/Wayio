import { createAdminClient } from '@/lib/supabase/admin'
import { PLANS, type PlanKey } from '@/constants/pricing'
import type { Trip } from '@/types/trip'
import type {
  TripRow,
  SubscriptionRow,
  ReferralRow,
  GroupMessageRow,
  GroupExpenseRow,
  TripMemberRow,
  ActivityVoteRow,
} from '@/types/database'
import type {
  ProfileRow,
  AiLogRow,
  FeatureFlagRow,
  AnnouncementRow,
  AdminAuditRow,
  AppSettingRow,
} from '@/types/admin'

const DAY_MS = 86_400_000
const PAGE_SIZE = 25

export interface DayPoint {
  date: string
  value: number
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

function bucketByDay(timestamps: string[], days: number): DayPoint[] {
  const counts = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    counts.set(new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10), 0)
  }
  for (const ts of timestamps) {
    const key = ts.slice(0, 10)
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].map(([date, value]) => ({ date, value }))
}

/** Precio mensual equivalente de un plan (para MRR). One-time y free = 0. */
function monthlyPrice(planId: string): number {
  const plan = PLANS[planId as PlanKey]
  if (!plan) return 0
  if (plan.periodo === 'único') return 0
  if (plan.periodo === 'año') return plan.precio / 12
  return plan.precio
}

// ===========================================================================
// DASHBOARD
// ===========================================================================

export interface DashboardMetrics {
  totalUsers: number
  newUsers24h: number
  newUsers7d: number
  newUsers30d: number
  totalTrips: number
  trips30d: number
  tripsByPackage: { basico: number; confort: number; premium: number }
  activeSubs: number
  mrr: number
  aiCalls30d: number
  aiCost30d: number
  aiTokens30d: number
  signupSeries: DayPoint[]
  tripSeries: DayPoint[]
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const admin = createAdminClient()
  const since24 = isoDaysAgo(1)
  const since7 = isoDaysAgo(7)
  const since30 = isoDaysAgo(30)
  const since14 = isoDaysAgo(14)
  const headCount = { count: 'exact' as const, head: true as const }

  const [
    totalUsersRes,
    newUsers24Res,
    newUsers7Res,
    newUsers30Res,
    totalTripsRes,
    trips30Res,
    basicoRes,
    confortRes,
    premiumRes,
    subsRes,
    aiRes,
    signupRowsRes,
    tripRowsRes,
  ] = await Promise.all([
    admin.from('profiles').select('*', headCount),
    admin.from('profiles').select('*', headCount).gte('created_at', since24),
    admin.from('profiles').select('*', headCount).gte('created_at', since7),
    admin.from('profiles').select('*', headCount).gte('created_at', since30),
    admin.from('trips').select('*', headCount),
    admin.from('trips').select('*', headCount).gte('created_at', since30),
    admin.from('trips').select('*', headCount).eq('paquete', 'basico'),
    admin.from('trips').select('*', headCount).eq('paquete', 'confort'),
    admin.from('trips').select('*', headCount).eq('paquete', 'premium'),
    admin
      .from('subscriptions')
      .select('plan_id, status')
      .eq('status', 'active'),
    admin
      .from('ai_logs')
      .select('cost_usd, total_tokens')
      .gte('created_at', since30),
    admin.from('profiles').select('created_at').gte('created_at', since14),
    admin.from('trips').select('created_at').gte('created_at', since14),
  ])

  const activeSubsData = (subsRes.data ?? []) as { plan_id: string }[]
  const aiData = (aiRes.data ?? []) as {
    cost_usd: number
    total_tokens: number
  }[]
  const signupRows = (signupRowsRes.data ?? []) as { created_at: string }[]
  const tripRows = (tripRowsRes.data ?? []) as { created_at: string }[]

  return {
    totalUsers: totalUsersRes.count ?? 0,
    newUsers24h: newUsers24Res.count ?? 0,
    newUsers7d: newUsers7Res.count ?? 0,
    newUsers30d: newUsers30Res.count ?? 0,
    totalTrips: totalTripsRes.count ?? 0,
    trips30d: trips30Res.count ?? 0,
    tripsByPackage: {
      basico: basicoRes.count ?? 0,
      confort: confortRes.count ?? 0,
      premium: premiumRes.count ?? 0,
    },
    activeSubs: activeSubsData.filter((s) => s.plan_id !== 'free').length,
    mrr: activeSubsData.reduce((sum, s) => sum + monthlyPrice(s.plan_id), 0),
    aiCalls30d: aiData.length,
    aiCost30d: aiData.reduce((sum, l) => sum + Number(l.cost_usd), 0),
    aiTokens30d: aiData.reduce((sum, l) => sum + l.total_tokens, 0),
    signupSeries: bucketByDay(
      signupRows.map((r) => r.created_at),
      14
    ),
    tripSeries: bucketByDay(
      tripRows.map((r) => r.created_at),
      14
    ),
  }
}

// ===========================================================================
// USUARIOS
// ===========================================================================

export interface UserListItem {
  profile: ProfileRow
  tier: string
  planId: string
  status: string | null
  tripCount: number
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export async function listUsers(opts: {
  search?: string | undefined
  role?: string | undefined
  page?: number | undefined
}): Promise<Paged<UserListItem>> {
  const admin = createAdminClient()
  const page = Math.max(1, opts.page ?? 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let q = admin.from('profiles').select('*', { count: 'exact' })
  if (opts.search) q = q.ilike('email', `%${opts.search}%`)
  if (opts.role && opts.role !== 'all') q = q.eq('role', opts.role)
  const { data, count } = await q
    .order('created_at', { ascending: false })
    .range(from, to)

  const profiles = (data ?? []) as ProfileRow[]
  const ids = profiles.map((p) => p.id)

  const [subsRes, tripsRes] = await Promise.all([
    admin
      .from('subscriptions')
      .select('user_id, tier, plan_id, status')
      .in('user_id', ids),
    admin.from('trips').select('user_id').in('user_id', ids),
  ])
  const subs = (subsRes.data ?? []) as {
    user_id: string
    tier: string
    plan_id: string
    status: string
  }[]
  const trips = (tripsRes.data ?? []) as { user_id: string }[]
  const subByUser = new Map(subs.map((s) => [s.user_id, s]))
  const tripCount = new Map<string, number>()
  for (const t of trips)
    tripCount.set(t.user_id, (tripCount.get(t.user_id) ?? 0) + 1)

  const items: UserListItem[] = profiles.map((p) => {
    const s = subByUser.get(p.id)
    return {
      profile: p,
      tier: s?.tier ?? 'free',
      planId: s?.plan_id ?? 'free',
      status: s?.status ?? null,
      tripCount: tripCount.get(p.id) ?? 0,
    }
  })

  return { items, total: count ?? 0, page, pageSize: PAGE_SIZE }
}

export interface UserTripSummary {
  id: string
  destino: string
  paquete: string
  estado: string
  created_at: string
}

export async function getUserDetail(id: string): Promise<{
  profile: ProfileRow | null
  subscription: SubscriptionRow | null
  trips: UserTripSummary[]
  referral: ReferralRow | null
}> {
  const admin = createAdminClient()
  const [profileRes, subRes, tripsRes, referralRes] = await Promise.all([
    admin.from('profiles').select('*').eq('id', id).maybeSingle(),
    admin.from('subscriptions').select('*').eq('user_id', id).maybeSingle(),
    admin
      .from('trips')
      .select('id, data, paquete, estado, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    admin.from('referrals').select('*').eq('user_id', id).maybeSingle(),
  ])

  const tripRows = (tripsRes.data ?? []) as {
    id: string
    data: Trip
    paquete: string
    estado: string
    created_at: string
  }[]

  return {
    profile: profileRes.data as ProfileRow | null,
    subscription: subRes.data as SubscriptionRow | null,
    referral: referralRes.data as ReferralRow | null,
    trips: tripRows.map((t) => ({
      id: t.id,
      destino: t.data?.destino ?? '—',
      paquete: t.paquete,
      estado: t.estado,
      created_at: t.created_at,
    })),
  }
}

// ===========================================================================
// VIAJES
// ===========================================================================

export interface TripListItem {
  id: string
  destino: string
  paquete: string
  estado: string
  presupuesto: number
  dias: number
  created_at: string
  ownerEmail: string | null
}

export async function listTrips(opts: {
  search?: string | undefined
  estado?: string | undefined
  page?: number | undefined
}): Promise<Paged<TripListItem>> {
  const admin = createAdminClient()
  const page = Math.max(1, opts.page ?? 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let q = admin
    .from('trips')
    .select('id, user_id, data, paquete, estado, created_at', {
      count: 'exact',
    })
  if (opts.estado && opts.estado !== 'all') q = q.eq('estado', opts.estado)
  if (opts.search) q = q.ilike('data->>destino', `%${opts.search}%`)
  const { data, count } = await q
    .order('created_at', { ascending: false })
    .range(from, to)

  const trips = (data ?? []) as {
    id: string
    user_id: string
    data: Trip
    paquete: string
    estado: string
    created_at: string
  }[]
  const ids = [...new Set(trips.map((t) => t.user_id))]
  const { data: profs } = await admin
    .from('profiles')
    .select('id, email')
    .in('id', ids)
  const emailById = new Map(
    ((profs ?? []) as { id: string; email: string | null }[]).map((p) => [
      p.id,
      p.email,
    ])
  )

  const items: TripListItem[] = trips.map((t) => ({
    id: t.id,
    destino: t.data?.destino ?? '—',
    paquete: t.paquete,
    estado: t.estado,
    presupuesto: t.data?.presupuestoTotal ?? 0,
    dias: t.data?.dias?.length ?? 0,
    created_at: t.created_at,
    ownerEmail: emailById.get(t.user_id) ?? null,
  }))

  return { items, total: count ?? 0, page, pageSize: PAGE_SIZE }
}

export async function getTripDetail(id: string): Promise<{
  trip: TripRow | null
  ownerEmail: string | null
  members: TripMemberRow[]
  messages: GroupMessageRow[]
  expenses: GroupExpenseRow[]
  votes: ActivityVoteRow[]
}> {
  const admin = createAdminClient()
  const [tripRes, membersRes, messagesRes, expensesRes, votesRes] =
    await Promise.all([
      admin.from('trips').select('*').eq('id', id).maybeSingle(),
      admin.from('trip_members').select('*').eq('trip_id', id),
      admin
        .from('group_messages')
        .select('*')
        .eq('trip_id', id)
        .order('created_at', { ascending: true }),
      admin.from('group_expenses').select('*').eq('trip_id', id),
      admin.from('activity_votes').select('*').eq('trip_id', id),
    ])

  const trip = tripRes.data as TripRow | null
  let ownerEmail: string | null = null
  if (trip) {
    const { data: p } = await admin
      .from('profiles')
      .select('email')
      .eq('id', trip.user_id)
      .maybeSingle()
    ownerEmail = (p as { email: string | null } | null)?.email ?? null
  }

  return {
    trip,
    ownerEmail,
    members: (membersRes.data ?? []) as TripMemberRow[],
    messages: (messagesRes.data ?? []) as GroupMessageRow[],
    expenses: (expensesRes.data ?? []) as GroupExpenseRow[],
    votes: (votesRes.data ?? []) as ActivityVoteRow[],
  }
}

// ===========================================================================
// SUSCRIPCIONES / INGRESOS
// ===========================================================================

export interface SubscriptionItem {
  sub: SubscriptionRow
  email: string | null
}

export async function getSubscriptionsData(): Promise<{
  items: SubscriptionItem[]
  mrr: number
  arr: number
  activeCount: number
  byTier: Record<string, number>
}> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  const subs = (data ?? []) as SubscriptionRow[]

  const ids = subs.map((s) => s.user_id)
  const { data: profs } = await admin
    .from('profiles')
    .select('id, email')
    .in('id', ids)
  const emailById = new Map(
    ((profs ?? []) as { id: string; email: string | null }[]).map((p) => [
      p.id,
      p.email,
    ])
  )

  const active = subs.filter(
    (s) => s.status === 'active' && s.plan_id !== 'free'
  )
  const mrr = active.reduce((sum, s) => sum + monthlyPrice(s.plan_id), 0)
  const byTier: Record<string, number> = { free: 0, pro: 0, grupo: 0 }
  for (const s of subs) byTier[s.tier] = (byTier[s.tier] ?? 0) + 1

  return {
    items: subs.map((s) => ({
      sub: s,
      email: emailById.get(s.user_id) ?? null,
    })),
    mrr,
    arr: mrr * 12,
    activeCount: active.length,
    byTier,
  }
}

// ===========================================================================
// GRUPOS / MODERACIÓN
// ===========================================================================

export async function getModerationData(): Promise<{
  messages: GroupMessageRow[]
  expenses: GroupExpenseRow[]
  groupCount: number
}> {
  const admin = createAdminClient()
  const [messagesRes, expensesRes, membersRes] = await Promise.all([
    admin
      .from('group_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('group_expenses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    admin.from('trip_members').select('trip_id'),
  ])
  const memberRows = (membersRes.data ?? []) as { trip_id: string }[]
  return {
    messages: (messagesRes.data ?? []) as GroupMessageRow[],
    expenses: (expensesRes.data ?? []) as GroupExpenseRow[],
    groupCount: new Set(memberRows.map((m) => m.trip_id)).size,
  }
}

// ===========================================================================
// REFERIDOS
// ===========================================================================

export async function listReferrals(): Promise<{
  items: { ref: ReferralRow; email: string | null }[]
  totalConversions: number
}> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('referrals')
    .select('*')
    .order('conversions', { ascending: false })
    .limit(200)
  const refs = (data ?? []) as ReferralRow[]
  const ids = refs.map((r) => r.user_id)
  const { data: profs } = await admin
    .from('profiles')
    .select('id, email')
    .in('id', ids)
  const emailById = new Map(
    ((profs ?? []) as { id: string; email: string | null }[]).map((p) => [
      p.id,
      p.email,
    ])
  )
  return {
    items: refs.map((r) => ({
      ref: r,
      email: emailById.get(r.user_id) ?? null,
    })),
    totalConversions: refs.reduce((s, r) => s + r.conversions, 0),
  }
}

// ===========================================================================
// USO DE IA
// ===========================================================================

export interface AiUsageStats {
  totalCalls: number
  totalCost: number
  totalTokens: number
  successRate: number
  avgLatency: number
  byProvider: {
    provider: string
    calls: number
    cost: number
    tokens: number
  }[]
  byModel: { model: string; calls: number; cost: number; tokens: number }[]
  recent: AiLogRow[]
  series: DayPoint[]
}

export async function getAiUsage(days = 30): Promise<AiUsageStats> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('ai_logs')
    .select('*')
    .gte('created_at', isoDaysAgo(days))
    .order('created_at', { ascending: false })
  const logs = (data ?? []) as AiLogRow[]

  const totalCalls = logs.length
  const totalCost = logs.reduce((s, l) => s + Number(l.cost_usd), 0)
  const totalTokens = logs.reduce((s, l) => s + l.total_tokens, 0)
  const successRate = totalCalls
    ? logs.filter((l) => l.success).length / totalCalls
    : 1
  const avgLatency = totalCalls
    ? Math.round(logs.reduce((s, l) => s + l.latency_ms, 0) / totalCalls)
    : 0

  const provMap = new Map<
    string,
    { calls: number; cost: number; tokens: number }
  >()
  const modelMap = new Map<
    string,
    { calls: number; cost: number; tokens: number }
  >()
  for (const l of logs) {
    const p = provMap.get(l.provider) ?? { calls: 0, cost: 0, tokens: 0 }
    provMap.set(l.provider, {
      calls: p.calls + 1,
      cost: p.cost + Number(l.cost_usd),
      tokens: p.tokens + l.total_tokens,
    })
    const m = modelMap.get(l.model) ?? { calls: 0, cost: 0, tokens: 0 }
    modelMap.set(l.model, {
      calls: m.calls + 1,
      cost: m.cost + Number(l.cost_usd),
      tokens: m.tokens + l.total_tokens,
    })
  }

  const costByDay = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--)
    costByDay.set(
      new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10),
      0
    )
  for (const l of logs) {
    const k = l.created_at.slice(0, 10)
    if (costByDay.has(k))
      costByDay.set(k, (costByDay.get(k) ?? 0) + Number(l.cost_usd))
  }

  return {
    totalCalls,
    totalCost,
    totalTokens,
    successRate,
    avgLatency,
    byProvider: [...provMap.entries()].map(([provider, v]) => ({
      provider,
      ...v,
    })),
    byModel: [...modelMap.entries()]
      .map(([model, v]) => ({ model, ...v }))
      .sort((a, b) => b.cost - a.cost),
    recent: logs.slice(0, 50),
    series: [...costByDay.entries()].map(([date, value]) => ({ date, value })),
  }
}

// ===========================================================================
// CONFIG: FLAGS / ANUNCIOS / SETTINGS / AUDITORÍA
// ===========================================================================

export async function listFlags(): Promise<FeatureFlagRow[]> {
  const admin = createAdminClient()
  const { data } = await admin.from('feature_flags').select('*').order('key')
  return (data ?? []) as FeatureFlagRow[]
}

export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []) as AnnouncementRow[]
}

export async function getSettings(): Promise<
  Record<string, Record<string, unknown>>
> {
  const admin = createAdminClient()
  const { data } = await admin.from('app_settings').select('*')
  const rows = (data ?? []) as AppSettingRow[]
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export async function listAudit(): Promise<AdminAuditRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  return (data ?? []) as AdminAuditRow[]
}
