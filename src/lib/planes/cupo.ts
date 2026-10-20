import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CUPO_GRATIS,
  NOMBRE_ACCION,
  type AccionConCupo,
  type FuncionPro,
} from '@/constants/planes'
import { diaRD } from '@/lib/admin/horaRD'
import { modoLocalSinCuentas, type Llamante } from '@/lib/ai/routeKit'
import { tierEfectivo } from '@/lib/stripe/entitlements'
import { createAdminClientSafe } from '@/lib/supabase/admin'
import type { SubscriptionRow } from '@/types/database'
import type { PlanTier } from '@/types/subscription'

/**
 * Planes aplicados en el SERVIDOR: cupo mensual del plan Gratis y funciones
 * solo Pro (catálogo público en src/constants/planes.ts).
 *
 * - Gratis (con cuenta): CUPO_GRATIS de cada acción por mes natural de RD;
 *   se renueva el día 1 a las 00:00 de RD. Se cuenta en usage_counters con
 *   las RPC consumir_cupo / devolver_cupo (migración 20261017130000), que
 *   comprueban y suman en una sola sentencia: dos peticiones a la vez nunca
 *   pasan del límite.
 * - Pro y Grupo (grupo ⊇ pro): sin cupo, con el uso justo de los topes por
 *   hora y día de src/lib/security/aiGuard.ts. Su uso se cuenta igual (con un
 *   límite enorme) para que el panel admin tenga conteos reales de todos.
 * - Orden en las rutas: sesión → rate limit → tope diario → cupo → IA. La
 *   ruta devuelve la unidad (`devolver()`) si la IA falla, se cancela o el
 *   resultado sale de la caché o del modo demo.
 * - Falla ABIERTO: si no se puede leer el plan o contar el uso (sin service
 *   role, migración sin aplicar, error de red), deja pasar y avisa (consola y
 *   Sentry) como mucho una vez por hora por instancia. Igual que el tope
 *   diario: es un límite de producto, no queremos tumbar la app por un fallo
 *   de lectura (los topes por hora y día y el tope de gasto siguen activos).
 */

/** Límite «sin límite» con el que se cuenta el uso de Pro (int4 máximo). */
const SIN_LIMITE = 2_147_483_647
/** Tiempo máximo de cada consulta: no frena las rutas de IA. */
const CONSULTA_TIMEOUT_MS = 3_000
/** Como mucho un aviso de «falla abierta» por hora y por instancia. */
const AVISO_MS = 3_600_000

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

/** Acciones con cupo, en el orden del catálogo. */
export const ACCIONES_CON_CUPO = Object.keys(CUPO_GRATIS) as AccionConCupo[]

const esAccionConCupo = (v: unknown): v is AccionConCupo =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(CUPO_GRATIS, v)

// ─── Periodo (mes natural de RD) ──────────────────────────────────────────

export interface PeriodoRD {
  /** Primer día del mes de RD en curso ('YYYY-MM-01'): la clave del cupo. */
  periodo: string
  /** Día en que se renueva el cupo ('YYYY-MM-01' del mes siguiente). */
  renueva: string
}

const primeroDeMes = (anio: number, mes: number): string =>
  `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-01`

/** Mes natural de RD de un instante y la fecha de renovación del cupo. */
export function periodoRD(ahora: number = Date.now()): PeriodoRD {
  const [a, m] = diaRD(ahora).split('-').map(Number)
  const anio = a ?? 1970
  const mes = m ?? 1
  return {
    periodo: primeroDeMes(anio, mes),
    renueva:
      mes === 12 ? primeroDeMes(anio + 1, 1) : primeroDeMes(anio, mes + 1),
  }
}

/** 'YYYY-MM-DD' → «1 de noviembre». */
function fechaLegible(dia: string): string {
  const [, m, d] = dia.split('-').map(Number)
  const mes = MESES[(m ?? 1) - 1] ?? ''
  return `${d ?? 1} de ${mes}`
}

// ─── Avisos de falla abierta ──────────────────────────────────────────────

let ultimoAviso = 0

function avisar(que: string, err: unknown): void {
  const ahora = Date.now()
  if (ahora - ultimoAviso < AVISO_MS) return
  ultimoAviso = ahora
  const detalle = err instanceof Error ? err.message : String(err)
  // eslint-disable-next-line no-console
  console.warn(
    `[wayio] planes-cupo: ${que}; los cupos y las funciones Pro quedan ABIERTOS hasta poder leerlos (${detalle})`
  )
  Sentry.captureMessage(`Planes: ${que}`, {
    level: 'warning',
    tags: { area: 'planes-cupo' },
    extra: { detalle },
  })
}

// ─── Plan efectivo ────────────────────────────────────────────────────────

const RANGO: Record<PlanTier, number> = { free: 0, pro: 1, grupo: 2 }

/** ¿El plan incluye lo de `nivel`? Grupo incluye todo lo de Pro. */
export function tieneNivel(tier: PlanTier, nivel: PlanTier): boolean {
  return RANGO[tier] >= RANGO[nivel]
}

/**
 * Plan efectivo del usuario leído con la service role (misma regla que la
 * RPC my_effective_tier, vía tierEfectivo). Sin fila de suscripción es
 * 'free'; devuelve null si NO se pudo leer (sin service role, error de BD o
 * de red), y avisa.
 */
export async function leerTier(userId: string): Promise<PlanTier | null> {
  const admin = createAdminClientSafe()
  if (!admin) {
    avisar('no se pudo leer el plan', 'falta SUPABASE_SERVICE_ROLE_KEY')
    return null
  }
  try {
    const { data, error } = await admin
      .from('subscriptions')
      .select('tier, status, stripe_subscription_id, current_period_end')
      .eq('user_id', userId)
      .abortSignal(AbortSignal.timeout(CONSULTA_TIMEOUT_MS))
      .maybeSingle()
    if (error) throw new Error(`subscriptions: ${error.message}`)
    const tier = tierEfectivo(
      (data as Pick<
        SubscriptionRow,
        'tier' | 'status' | 'stripe_subscription_id' | 'current_period_end'
      > | null) ?? null
    )
    return Object.prototype.hasOwnProperty.call(RANGO, tier) ? tier : 'free'
  } catch (err) {
    avisar('no se pudo leer el plan', err)
    return null
  }
}

// ─── Cupo mensual ─────────────────────────────────────────────────────────

export interface CupoReservado {
  ok: true
  /** Plan leído (null si no aplica o no se pudo leer). */
  tier: PlanTier | null
  /**
   * Devuelve la unidad consumida (IA fallida, cancelada, de la caché o del
   * demo). No-op si no se consumió; solo actúa la primera vez; nunca lanza.
   */
  devolver: () => Promise<void>
}

export type ResultadoCupo = CupoReservado | { ok: false; response: Response }

const nada = async (): Promise<void> => undefined

/** Paso libre sin contar nada (modo local, falla abierta, caché...). */
export function sinConsumo(tier: PlanTier | null = null): CupoReservado {
  return { ok: true, tier, devolver: nada }
}

const PRO_SIN_LIMITE: Record<AccionConCupo, string> = {
  generar: 'Con Pro trazas sin límite.',
  ajustar: 'Con Pro ajustas sin límite.',
  analizar: 'Con Pro creas viajes desde fotos y videos sin límite.',
}

/** «Usaste tus 2 viajes gratis de este mes. Se renuevan el 1 de…». */
export function mensajeCupoAgotado(
  accion: AccionConCupo,
  limite: number,
  renueva: string
): string {
  const nombre = NOMBRE_ACCION[accion]
  const fecha = fechaLegible(renueva)
  const usado =
    limite <= 0
      ? `Tu plan Gratis no incluye ${nombre.varios}.`
      : limite === 1
        ? `Usaste tu ${nombre.uno} gratis de este mes. Se renueva el ${fecha}.`
        : `Usaste tus ${limite} ${nombre.varios} gratis de este mes. Se renuevan el ${fecha}.`
  return `${usado} ${PRO_SIN_LIMITE[accion]}`
}

/**
 * 402 del contrato: {error, code:'cupo_agotado', accion, usados, limite,
 * renueva}. `usados` = límite (el cupo está agotado).
 */
function respuestaCupoAgotado(
  accion: AccionConCupo,
  limite: number,
  renueva: string
): Response {
  return Response.json(
    {
      error: mensajeCupoAgotado(accion, limite, renueva),
      code: 'cupo_agotado',
      accion,
      usados: Math.max(0, limite),
      limite,
      renueva,
    },
    { status: 402, headers: { 'Cache-Control': 'no-store' } }
  )
}

type Consumo = { ok: true; usados: number | null } | { ok: false }

/** RPC consumir_cupo: nuevo total, null si está agotado, ok:false si falla. */
async function consumir(
  userId: string,
  accion: AccionConCupo,
  periodo: string,
  limite: number
): Promise<Consumo> {
  const admin = createAdminClientSafe()
  if (!admin) {
    avisar('no se pudo contar el uso', 'falta SUPABASE_SERVICE_ROLE_KEY')
    return { ok: false }
  }
  try {
    const { data, error } = await admin
      .rpc('consumir_cupo', {
        p_user: userId,
        p_accion: accion,
        p_periodo: periodo,
        p_limite: limite,
      })
      .abortSignal(AbortSignal.timeout(CONSULTA_TIMEOUT_MS))
    if (error) throw new Error(`RPC consumir_cupo: ${error.message}`)
    if (data === null || data === undefined) return { ok: true, usados: null }
    const usados = Number(data)
    if (!Number.isFinite(usados)) {
      throw new Error('RPC consumir_cupo: respuesta no numérica')
    }
    return { ok: true, usados }
  } catch (err) {
    avisar('no se pudo contar el uso', err)
    return { ok: false }
  }
}

/** devolver() de una unidad ya consumida (mismo periodo en que se consumió). */
function devolvedor(
  userId: string,
  accion: AccionConCupo,
  periodo: string
): () => Promise<void> {
  let pendiente = true
  return async () => {
    if (!pendiente) return
    pendiente = false
    const admin = createAdminClientSafe()
    if (!admin) return
    try {
      const { error } = await admin
        .rpc('devolver_cupo', {
          p_user: userId,
          p_accion: accion,
          p_periodo: periodo,
        })
        .abortSignal(AbortSignal.timeout(CONSULTA_TIMEOUT_MS))
      if (error) throw new Error(`RPC devolver_cupo: ${error.message}`)
    } catch (err) {
      avisar('no se pudo devolver una unidad del cupo', err)
    }
  }
}

/**
 * Consume una unidad del cupo mensual de `accion` antes de gastar IA.
 *
 * - Modo local sin cuentas o sin usuario: pasa sin contar.
 * - Pro o Grupo: pasa siempre; el uso se cuenta con un límite enorme.
 * - Gratis: consume de CUPO_GRATIS; agotado → `{ ok: false, response }` con
 *   el 402 'cupo_agotado'.
 * - Plan ilegible o RPC caída: pasa sin contar (falla abierta, con aviso).
 */
export async function exigirCupo(
  llamante: Llamante,
  accion: AccionConCupo
): Promise<ResultadoCupo> {
  const userId = llamante.user?.id
  if (modoLocalSinCuentas() || !userId) return sinConsumo()

  const tier = await leerTier(userId)
  if (tier === null) return sinConsumo()

  const { periodo, renueva } = periodoRD()
  const esPro = tieneNivel(tier, 'pro')
  const limite = esPro ? SIN_LIMITE : CUPO_GRATIS[accion]
  const consumo = await consumir(userId, accion, periodo, limite)
  if (!consumo.ok) return sinConsumo(tier)
  if (consumo.usados === null) {
    return esPro
      ? sinConsumo(tier)
      : { ok: false, response: respuestaCupoAgotado(accion, limite, renueva) }
  }
  return { ok: true, tier, devolver: devolvedor(userId, accion, periodo) }
}

// ─── Funciones solo Pro ───────────────────────────────────────────────────

/** Plan mínimo de cada función reservada (grupo ⊇ pro). */
const NIVEL_FUNCION: Record<FuncionPro, PlanTier> = {
  alertas_ia: 'pro',
  reagendar_ia: 'pro',
}

/**
 * ¿Puede usar esta función solo Pro? true/false, o null si no se pudo leer
 * el plan: el llamador lo trata como PERMITIDO (falla abierta; leerTier ya
 * avisó). En modo local sin cuentas siempre true.
 */
export async function exigirPro(
  llamante: Llamante,
  funcion: FuncionPro
): Promise<boolean | null> {
  if (modoLocalSinCuentas()) return true
  const userId = llamante.user?.id
  if (!userId) return false
  const tier = await leerTier(userId)
  if (tier === null) return null
  return tieneNivel(tier, NIVEL_FUNCION[funcion])
}

// ─── Lectura del uso (GET /api/cupo) ──────────────────────────────────────

export type UsoDelMes = Record<AccionConCupo, number>

/**
 * Uso del mes del usuario. Con el cliente del usuario la RLS le deja ver
 * solo sus filas; con la service role, cualquiera. null si no se pudo leer.
 */
export async function leerUsoDelMes(
  cliente: SupabaseClient,
  userId: string,
  periodo: string
): Promise<UsoDelMes | null> {
  try {
    const { data, error } = await cliente
      .from('usage_counters')
      .select('accion, usados')
      .eq('user_id', userId)
      .eq('periodo', periodo)
      .abortSignal(AbortSignal.timeout(CONSULTA_TIMEOUT_MS))
    if (error) throw new Error(`usage_counters: ${error.message}`)
    const uso: UsoDelMes = { generar: 0, ajustar: 0, analizar: 0 }
    for (const fila of (data ?? []) as { accion: unknown; usados: unknown }[]) {
      if (!esAccionConCupo(fila.accion)) continue
      const n = Number(fila.usados)
      uso[fila.accion] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
    }
    return uso
  } catch (err) {
    avisar('no se pudo leer el uso del mes', err)
    return null
  }
}
