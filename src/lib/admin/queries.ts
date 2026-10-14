import 'server-only'
import type { PostgrestError } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from './auth'
import { diaRD, horaRDaIso, ultimosDiasRD } from './horaRD'
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
/** PostgREST corta cada respuesta en 1,000 filas (max-rows de Supabase). */
const LOTE = 1000
/** Tope de seguridad para las agregaciones en memoria. */
const MAX_FILAS = 50_000
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface DayPoint {
  date: string
  value: number
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

/**
 * Instante (ISO) en que empieza el primero de los últimos `dias` días
 * naturales de RD: el periodo «últimos 7 días» es hoy y los 6 anteriores.
 */
function inicioPeriodoRD(dias: number): string {
  const primero = ultimosDiasRD(dias)[0]
  return (primero ? horaRDaIso(`${primero}T00:00`) : null) ?? isoDaysAgo(dias)
}

/**
 * Serie de los últimos `days` días naturales de RD (hoy incluido), agrupando
 * por el día de Santo Domingo de cada fila. `valor` es lo que suma cada fila
 * (1 = contar filas).
 */
function bucketByDay<T>(
  rows: readonly T[],
  days: number,
  instante: (fila: T) => string,
  valor: (fila: T) => number = () => 1
): DayPoint[] {
  const sumas = new Map(ultimosDiasRD(days).map((d) => [d, 0]))
  for (const r of rows) {
    const clave = diaRD(instante(r))
    const actual = sumas.get(clave)
    if (actual !== undefined) sumas.set(clave, actual + valor(r))
  }
  return [...sumas.entries()].map(([date, value]) => ({ date, value }))
}

// ─── Errores: se propagan, no se esconden ─────────────────────────────────

interface Respuesta {
  data: unknown
  error: PostgrestError | null
  count?: number | null
}

/**
 * Si la consulta falló, LANZA: la sección muestra su error.tsx («Reintentar»)
 * en vez de una lista vacía o un 0 que parecen datos reales (DISENO §5.13).
 * «Sin filas» no es un error: llega como [] (listas) o null (maybeSingle).
 */
function comprobar(res: Respuesta, contexto: string): void {
  if (res.error) {
    throw new Error(
      `No se pudo leer ${contexto} (${res.error.code || 'sin código'}): ${res.error.message}`
    )
  }
}

function filas<T>(res: Respuesta, contexto: string): T[] {
  comprobar(res, contexto)
  return Array.isArray(res.data) ? (res.data as T[]) : []
}

function fila<T>(res: Respuesta, contexto: string): T | null {
  comprobar(res, contexto)
  return (res.data ?? null) as T | null
}

function cuenta(res: Respuesta, contexto: string): number {
  comprobar(res, contexto)
  return res.count ?? 0
}

/**
 * Página de una lista: pedir una página más allá del final (?page=99) no es
 * un fallo, es una página vacía (PostgREST responde 416 / PGRST103).
 */
function pagina<T>(res: Respuesta, contexto: string): T[] {
  if (res.error?.code === 'PGRST103') return []
  return filas<T>(res, contexto)
}

/**
 * Todas las filas de una consulta, por lotes de 1,000 (si no, un periodo de
 * 90 días se quedaría corto sin avisar). La consulta debe ir ordenada y
 * construirse de nuevo en cada llamada.
 */
async function todas<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<Respuesta>,
  contexto: string
): Promise<T[]> {
  const out: T[] = []
  for (let desde = 0; desde < MAX_FILAS; desde += LOTE) {
    const lote = filas<T>(await consulta(desde, desde + LOTE - 1), contexto)
    out.push(...lote)
    if (lote.length < LOTE) break
  }
  return out
}

/** Correo de cada perfil (para las listas que muestran el dueño). */
async function emailsPorId(
  admin: ReturnType<typeof createAdminClient>,
  ids: readonly string[],
  contexto: string
): Promise<Map<string, string | null>> {
  const unicos = [...new Set(ids)]
  if (unicos.length === 0) return new Map()
  const res = await admin.from('profiles').select('id, email').in('id', unicos)
  return new Map(
    filas<{ id: string; email: string | null }>(res, contexto).map((p) => [
      p.id,
      p.email,
    ])
  )
}

/** Precio mensual equivalente de un plan (para MRR). One-time y free = 0. */
function monthlyPrice(planId: string): number {
  const plan = PLANS[planId as PlanKey]
  if (!plan) return 0
  if (plan.periodo === 'único') return 0
  if (plan.periodo === 'año') return plan.precio / 12
  return plan.precio
}

interface SubParaMrr {
  plan_id: string
  status: string
  source?: string | null
  stripe_subscription_id?: string | null
}

/**
 * ¿Cuenta como ingreso recurrente? Solo suscripciones activas COBRADAS en
 * Stripe: los planes concedidos a mano (source 'admin', sin suscripción de
 * Stripe) no son ingresos y no entran en el MRR (MON-13).
 */
function esIngresoRecurrente(s: SubParaMrr): boolean {
  return (
    s.status === 'active' &&
    s.plan_id !== 'free' &&
    s.source !== 'admin' &&
    Boolean(s.stripe_subscription_id)
  )
}

/** ¿Plan de pago concedido a mano desde el panel? */
function esConcedidoAMano(s: SubParaMrr): boolean {
  return (
    s.plan_id !== 'free' &&
    (s.source === 'admin' ||
      (s.source === undefined && !s.stripe_subscription_id))
  )
}

// ===========================================================================
// DASHBOARD
// ===========================================================================

/** Periodos del selector del Panel (7 d | 30 d | 90 d). */
export const RANGOS_PANEL = [7, 30, 90] as const
export type RangoPanel = (typeof RANGOS_PANEL)[number]

export interface DashboardMetrics {
  /** Días del periodo elegido. */
  rango: RangoPanel
  totalUsers: number
  /** Altas de hoy (día de RD). */
  newUsersHoy: number
  newUsers7d: number
  /** Altas en el periodo y en el periodo anterior de igual largo. */
  newUsersPeriodo: number
  newUsersPeriodoPrevio: number
  totalTrips: number
  tripsPeriodo: number
  tripsPeriodoPrevio: number
  tripsByPackage: { basico: number; confort: number; premium: number }
  activeSubs: number
  mrr: number
  aiCallsPeriodo: number
  aiCostPeriodo: number
  aiTokensPeriodo: number
  /** Una barra por día del periodo (días de RD). */
  signupSeries: DayPoint[]
  tripSeries: DayPoint[]
}

export async function getDashboardMetrics(
  rango: RangoPanel = 30
): Promise<DashboardMetrics> {
  await requireAdmin()
  const admin = createAdminClient()
  const desde = inicioPeriodoRD(rango)
  const desdePrevio = inicioPeriodoRD(rango * 2)
  const headCount = { count: 'exact' as const, head: true as const }

  const [
    totalUsersRes,
    usersPrevioRes,
    totalTripsRes,
    tripsPrevioRes,
    basicoRes,
    confortRes,
    premiumRes,
    activeSubsData,
    aiData,
    signupRows,
    tripRows,
  ] = await Promise.all([
    admin.from('profiles').select('*', headCount),
    admin
      .from('profiles')
      .select('*', headCount)
      .gte('created_at', desdePrevio)
      .lt('created_at', desde),
    admin.from('trips').select('*', headCount),
    admin
      .from('trips')
      .select('*', headCount)
      .gte('created_at', desdePrevio)
      .lt('created_at', desde),
    admin.from('trips').select('*', headCount).eq('paquete', 'basico'),
    admin.from('trips').select('*', headCount).eq('paquete', 'confort'),
    admin.from('trips').select('*', headCount).eq('paquete', 'premium'),
    // select('*'): así funciona con o sin la columna source (migración)
    todas<SubParaMrr>(
      (a, b) =>
        admin
          .from('subscriptions')
          .select('*')
          .eq('status', 'active')
          .order('created_at')
          .range(a, b),
      'las suscripciones activas'
    ),
    todas<{ cost_usd: number; total_tokens: number }>(
      (a, b) =>
        admin
          .from('ai_logs')
          .select('cost_usd, total_tokens, created_at')
          .gte('created_at', desde)
          .order('created_at')
          .range(a, b),
      'el uso de IA del periodo'
    ),
    todas<{ created_at: string }>(
      (a, b) =>
        admin
          .from('profiles')
          .select('created_at')
          .gte('created_at', desde)
          .order('created_at')
          .range(a, b),
      'los registros del periodo'
    ),
    todas<{ created_at: string }>(
      (a, b) =>
        admin
          .from('trips')
          .select('created_at')
          .gte('created_at', desde)
          .order('created_at')
          .range(a, b),
      'los viajes del periodo'
    ),
  ])

  const signupSeries = bucketByDay(signupRows, rango, (r) => r.created_at)
  const tripSeries = bucketByDay(tripRows, rango, (r) => r.created_at)
  const suma = (serie: DayPoint[]) => serie.reduce((s, p) => s + p.value, 0)

  return {
    rango,
    totalUsers: cuenta(totalUsersRes, 'el total de usuarios'),
    newUsersHoy: signupSeries.at(-1)?.value ?? 0,
    newUsers7d: suma(signupSeries.slice(-7)),
    newUsersPeriodo: suma(signupSeries),
    newUsersPeriodoPrevio: cuenta(usersPrevioRes, 'los registros previos'),
    totalTrips: cuenta(totalTripsRes, 'el total de viajes'),
    tripsPeriodo: suma(tripSeries),
    tripsPeriodoPrevio: cuenta(tripsPrevioRes, 'los viajes previos'),
    tripsByPackage: {
      basico: cuenta(basicoRes, 'los viajes Básico'),
      confort: cuenta(confortRes, 'los viajes Confort'),
      premium: cuenta(premiumRes, 'los viajes Premium'),
    },
    activeSubs: activeSubsData.filter((s) => s.plan_id !== 'free').length,
    mrr: activeSubsData
      .filter(esIngresoRecurrente)
      .reduce((sum, s) => sum + monthlyPrice(s.plan_id), 0),
    aiCallsPeriodo: aiData.length,
    aiCostPeriodo: aiData.reduce((sum, l) => sum + Number(l.cost_usd), 0),
    aiTokensPeriodo: aiData.reduce((sum, l) => sum + Number(l.total_tokens), 0),
    signupSeries,
    tripSeries,
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

export interface PagedConConteos<T> extends Paged<T> {
  /**
   * Filas por cada opción del filtro ('all' incluido), con la búsqueda
   * aplicada: cada chip muestra su número.
   */
  conteos: Record<string, number>
}

/** Valores del filtro de rol de /admin/users. */
export const ROLES_FILTRO = ['user', 'admin'] as const

export async function listUsers(opts: {
  search?: string | undefined
  role?: string | undefined
  page?: number | undefined
}): Promise<PagedConConteos<UserListItem>> {
  await requireAdmin()
  const admin = createAdminClient()
  const page = Math.max(1, opts.page ?? 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const contar = (rol?: string) => {
    let c = admin.from('profiles').select('*', { count: 'exact', head: true })
    if (opts.search) c = c.ilike('email', `%${opts.search}%`)
    if (rol) c = c.eq('role', rol)
    return c
  }

  let q = admin.from('profiles').select('*', { count: 'exact' })
  if (opts.search) q = q.ilike('email', `%${opts.search}%`)
  if (opts.role && opts.role !== 'all') q = q.eq('role', opts.role)

  const [res, ...conteoRes] = await Promise.all([
    q.order('created_at', { ascending: false }).range(from, to),
    contar(),
    ...ROLES_FILTRO.map((r) => contar(r)),
  ])

  const conteos: Record<string, number> = {}
  ;['all', ...ROLES_FILTRO].forEach((clave, i) => {
    const r = conteoRes[i]
    if (r) conteos[clave] = cuenta(r, 'el conteo de usuarios por rol')
  })

  const profiles = pagina<ProfileRow>(res, 'los usuarios')
  const ids = profiles.map((p) => p.id)

  type PlanUsuario = {
    user_id: string
    tier: string
    plan_id: string
    status: string
  }
  let subs: PlanUsuario[] = []
  let trips: { user_id: string }[] = []
  if (ids.length > 0) {
    const [subsRes, tripRows] = await Promise.all([
      admin
        .from('subscriptions')
        .select('user_id, tier, plan_id, status')
        .in('user_id', ids),
      todas<{ user_id: string }>(
        (a, b) =>
          admin
            .from('trips')
            .select('user_id')
            .in('user_id', ids)
            .order('id')
            .range(a, b),
        'los viajes de los usuarios'
      ),
    ])
    subs = filas<PlanUsuario>(subsRes, 'los planes de los usuarios')
    trips = tripRows
  }
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

  const filtro = opts.role && opts.role !== 'all' ? opts.role : 'all'
  return {
    items,
    total: res.count ?? conteos[filtro] ?? 0,
    page,
    pageSize: PAGE_SIZE,
    conteos,
  }
}

export interface UserTripSummary {
  id: string
  destino: string
  paquete: string
  estado: string
  created_at: string
}

/** Uso de IA de una persona (ai_logs.user_id) en los últimos `days` días. */
export interface UserAiUsage {
  days: number
  calls: number
  /** 0–1. */
  successRate: number
  tokens: number
  cost: number
  lastCallAt: string | null
  byModel: {
    model: string
    provider: string
    calls: number
    cost: number
    tokens: number
  }[]
}

export interface UserDetail {
  profile: ProfileRow | null
  subscription: SubscriptionRow | null
  trips: UserTripSummary[]
  referral: ReferralRow | null
  ai: UserAiUsage
}

/** Días del uso de IA de la ficha de usuario. */
export const DIAS_IA_USUARIO = 30

type LogIaResumen = Pick<
  AiLogRow,
  'provider' | 'model' | 'success' | 'total_tokens' | 'cost_usd' | 'created_at'
>

/** Resume llamadas de IA (ordenadas de la más reciente a la más antigua). */
function resumirIa(logs: readonly LogIaResumen[], days: number): UserAiUsage {
  const porModelo = new Map<string, UserAiUsage['byModel'][number]>()
  for (const l of logs) {
    const m = porModelo.get(l.model) ?? {
      model: l.model,
      provider: l.provider,
      calls: 0,
      cost: 0,
      tokens: 0,
    }
    m.calls += 1
    m.cost += Number(l.cost_usd)
    m.tokens += Number(l.total_tokens)
    porModelo.set(l.model, m)
  }
  const calls = logs.length
  return {
    days,
    calls,
    successRate: calls ? logs.filter((l) => l.success).length / calls : 0,
    tokens: logs.reduce((s, l) => s + Number(l.total_tokens), 0),
    cost: logs.reduce((s, l) => s + Number(l.cost_usd), 0),
    lastCallAt: logs[0]?.created_at ?? null,
    byModel: [...porModelo.values()].sort(
      (a, b) => b.cost - a.cost || b.calls - a.calls
    ),
  }
}

export async function getUserDetail(id: string): Promise<UserDetail> {
  await requireAdmin()
  // Un id que no es UUID no existe (y Postgres lo rechazaría con un error):
  // la página responde 404, no «No pudimos cargar».
  if (!UUID_RE.test(id)) {
    return {
      profile: null,
      subscription: null,
      trips: [],
      referral: null,
      ai: resumirIa([], DIAS_IA_USUARIO),
    }
  }
  const admin = createAdminClient()
  const [profileRes, subRes, tripsRes, referralRes, logs] = await Promise.all([
    admin.from('profiles').select('*').eq('id', id).maybeSingle(),
    admin.from('subscriptions').select('*').eq('user_id', id).maybeSingle(),
    admin
      .from('trips')
      .select('id, data, paquete, estado, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    admin.from('referrals').select('*').eq('user_id', id).maybeSingle(),
    todas<LogIaResumen>(
      (a, b) =>
        admin
          .from('ai_logs')
          .select(
            'provider, model, success, total_tokens, cost_usd, created_at'
          )
          .eq('user_id', id)
          .gte('created_at', inicioPeriodoRD(DIAS_IA_USUARIO))
          .order('created_at', { ascending: false })
          .range(a, b),
      'el uso de IA del usuario'
    ),
  ])

  const tripRows = filas<{
    id: string
    data: Trip
    paquete: string
    estado: string
    created_at: string
  }>(tripsRes, 'los viajes del usuario')

  return {
    profile: fila<ProfileRow>(profileRes, 'el perfil'),
    subscription: fila<SubscriptionRow>(subRes, 'la suscripción'),
    referral: fila<ReferralRow>(referralRes, 'el código de referido'),
    trips: tripRows.map((t) => ({
      id: t.id,
      destino: t.data?.destino ?? '—',
      paquete: t.paquete,
      estado: t.estado,
      created_at: t.created_at,
    })),
    ai: resumirIa(logs, DIAS_IA_USUARIO),
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
  /** Moneda del viaje (la del presupuesto). */
  moneda: string
  dias: number
  created_at: string
  ownerEmail: string | null
}

/** Valores del filtro de estado de /admin/trips. */
export const ESTADOS_FILTRO = [
  'planificando',
  'en_viaje',
  'completado',
] as const

export async function listTrips(opts: {
  search?: string | undefined
  estado?: string | undefined
  page?: number | undefined
}): Promise<PagedConConteos<TripListItem>> {
  await requireAdmin()
  const admin = createAdminClient()
  const page = Math.max(1, opts.page ?? 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const contar = (estado?: string) => {
    let c = admin.from('trips').select('*', { count: 'exact', head: true })
    if (opts.search) c = c.ilike('data->>destino', `%${opts.search}%`)
    if (estado) c = c.eq('estado', estado)
    return c
  }

  let q = admin
    .from('trips')
    .select('id, user_id, data, paquete, estado, created_at', {
      count: 'exact',
    })
  if (opts.estado && opts.estado !== 'all') q = q.eq('estado', opts.estado)
  if (opts.search) q = q.ilike('data->>destino', `%${opts.search}%`)

  const [res, ...conteoRes] = await Promise.all([
    q.order('created_at', { ascending: false }).range(from, to),
    contar(),
    ...ESTADOS_FILTRO.map((e) => contar(e)),
  ])

  const conteos: Record<string, number> = {}
  ;['all', ...ESTADOS_FILTRO].forEach((clave, i) => {
    const r = conteoRes[i]
    if (r) conteos[clave] = cuenta(r, 'el conteo de viajes por estado')
  })

  const trips = pagina<{
    id: string
    user_id: string
    data: Trip
    paquete: string
    estado: string
    created_at: string
  }>(res, 'los viajes')
  const emailById = await emailsPorId(
    admin,
    trips.map((t) => t.user_id),
    'los dueños de los viajes'
  )

  const items: TripListItem[] = trips.map((t) => ({
    id: t.id,
    destino: t.data?.destino ?? '—',
    paquete: t.paquete,
    estado: t.estado,
    presupuesto: t.data?.presupuestoTotal ?? 0,
    moneda: t.data?.moneda ?? 'USD',
    dias: t.data?.dias?.length ?? 0,
    created_at: t.created_at,
    ownerEmail: emailById.get(t.user_id) ?? null,
  }))

  const filtro = opts.estado && opts.estado !== 'all' ? opts.estado : 'all'
  return {
    items,
    total: res.count ?? conteos[filtro] ?? 0,
    page,
    pageSize: PAGE_SIZE,
    conteos,
  }
}

export async function getTripDetail(id: string): Promise<{
  trip: TripRow | null
  ownerEmail: string | null
  members: TripMemberRow[]
  messages: GroupMessageRow[]
  expenses: GroupExpenseRow[]
  votes: ActivityVoteRow[]
}> {
  await requireAdmin()
  const vacio = {
    trip: null,
    ownerEmail: null,
    members: [],
    messages: [],
    expenses: [],
    votes: [],
  }
  // Un id que no es UUID no existe: 404, no error.
  if (!UUID_RE.test(id)) return vacio
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

  const trip = fila<TripRow>(tripRes, 'el viaje')
  if (!trip) return vacio
  const emails = await emailsPorId(admin, [trip.user_id], 'el dueño del viaje')

  return {
    trip,
    ownerEmail: emails.get(trip.user_id) ?? null,
    members: filas<TripMemberRow>(membersRes, 'los miembros del viaje'),
    messages: filas<GroupMessageRow>(messagesRes, 'el chat del viaje'),
    expenses: filas<GroupExpenseRow>(expensesRes, 'los gastos del viaje'),
    votes: filas<ActivityVoteRow>(votesRes, 'los votos del viaje'),
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
  /** Planes de pago activos (incluidos los concedidos a mano). */
  activeCount: number
  /** Suscripciones activas cobradas en Stripe (las que suman al MRR). */
  payingCount: number
  /** Planes de pago concedidos a mano desde el panel (no suman al MRR). */
  manualCount: number
  byTier: Record<string, number>
}> {
  await requireAdmin()
  const admin = createAdminClient()
  const res = await admin
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  const subs = filas<SubscriptionRow>(res, 'las suscripciones')
  const emailById = await emailsPorId(
    admin,
    subs.map((s) => s.user_id),
    'los correos de los suscriptores'
  )

  const active = subs.filter(
    (s) => s.status === 'active' && s.plan_id !== 'free'
  )
  const paying = active.filter(esIngresoRecurrente)
  const mrr = paying.reduce((sum, s) => sum + monthlyPrice(s.plan_id), 0)
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
    payingCount: paying.length,
    manualCount: active.filter(esConcedidoAMano).length,
    byTier,
  }
}

// ===========================================================================
// GRUPOS / MODERACIÓN
// ===========================================================================

/** Gasto de un grupo con la moneda y el destino de su viaje. */
export interface ModerationExpense extends GroupExpenseRow {
  /** Moneda del viaje ('USD' si el viaje no la indica). */
  moneda: string
  destino: string | null
}

export async function getModerationData(): Promise<{
  messages: GroupMessageRow[]
  expenses: ModerationExpense[]
  groupCount: number
}> {
  await requireAdmin()
  const admin = createAdminClient()
  const [messagesRes, expensesRes, memberRows] = await Promise.all([
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
    todas<{ trip_id: string }>(
      (a, b) =>
        admin.from('trip_members').select('trip_id').order('id').range(a, b),
      'los miembros de los grupos'
    ),
  ])
  const expenses = filas<GroupExpenseRow>(expensesRes, 'los gastos recientes')

  // Solo la moneda y el destino de cada viaje (no el itinerario entero).
  const tripIds = [...new Set(expenses.map((e) => e.trip_id))]
  const viajes = new Map<
    string,
    { moneda: string | null; destino: string | null }
  >()
  if (tripIds.length > 0) {
    const res = await admin
      .from('trips')
      .select('id, moneda:data->>moneda, destino:data->>destino')
      .in('id', tripIds)
    for (const t of filas<{
      id: string
      moneda: string | null
      destino: string | null
    }>(res, 'la moneda de los viajes')) {
      viajes.set(t.id, { moneda: t.moneda, destino: t.destino })
    }
  }

  // El dueño ya es miembro de su propio viaje: un "grupo" de verdad es un
  // viaje con al menos 2 miembros.
  const porViaje = new Map<string, number>()
  for (const m of memberRows) {
    porViaje.set(m.trip_id, (porViaje.get(m.trip_id) ?? 0) + 1)
  }
  return {
    messages: filas<GroupMessageRow>(messagesRes, 'los mensajes recientes'),
    expenses: expenses.map((e) => {
      const v = viajes.get(e.trip_id)
      return {
        ...e,
        moneda: v?.moneda || 'USD',
        destino: v?.destino || null,
      }
    }),
    groupCount: [...porViaje.values()].filter((n) => n >= 2).length,
  }
}

// ===========================================================================
// REFERIDOS
// ===========================================================================

export async function listReferrals(): Promise<{
  items: { ref: ReferralRow; email: string | null }[]
  totalConversions: number
}> {
  await requireAdmin()
  const admin = createAdminClient()
  const res = await admin
    .from('referrals')
    .select('*')
    .order('conversions', { ascending: false })
    .limit(200)
  const refs = filas<ReferralRow>(res, 'los referidos')
  const emailById = await emailsPorId(
    admin,
    refs.map((r) => r.user_id),
    'los correos de los referidos'
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
  await requireAdmin()
  const admin = createAdminClient()
  const desde = inicioPeriodoRD(days)
  const logs = await todas<AiLogRow>(
    (a, b) =>
      admin
        .from('ai_logs')
        .select('*')
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .range(a, b),
    'el uso de IA'
  )

  const totalCalls = logs.length
  const totalCost = logs.reduce((s, l) => s + Number(l.cost_usd), 0)
  const totalTokens = logs.reduce((s, l) => s + Number(l.total_tokens), 0)
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
      tokens: p.tokens + Number(l.total_tokens),
    })
    const m = modelMap.get(l.model) ?? { calls: 0, cost: 0, tokens: 0 }
    modelMap.set(l.model, {
      calls: m.calls + 1,
      cost: m.cost + Number(l.cost_usd),
      tokens: m.tokens + Number(l.total_tokens),
    })
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
    series: bucketByDay(
      logs,
      days,
      (l) => l.created_at,
      (l) => Number(l.cost_usd)
    ),
  }
}

// ===========================================================================
// CONFIG: FLAGS / ANUNCIOS / SETTINGS / AUDITORÍA
// ===========================================================================

export async function listFlags(): Promise<FeatureFlagRow[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const res = await admin.from('feature_flags').select('*').order('key')
  return filas<FeatureFlagRow>(res, 'las funciones')
}

export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const res = await admin
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
  return filas<AnnouncementRow>(res, 'los anuncios')
}

export async function getSettings(): Promise<
  Record<string, Record<string, unknown>>
> {
  await requireAdmin()
  const admin = createAdminClient()
  const res = await admin.from('app_settings').select('*')
  const rows = filas<AppSettingRow>(res, 'los ajustes')
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export async function listAudit(): Promise<AdminAuditRow[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const res = await admin
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  return filas<AdminAuditRow>(res, 'la auditoría')
}
