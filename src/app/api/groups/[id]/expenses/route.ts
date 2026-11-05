import { z } from 'zod'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { exigirMiembro } from '../../_lib/grupo'
import {
  UUID_RE,
  autenticar,
  errorDb,
  errorJson,
  esFaltaDeEsquema,
  leerJson,
  nombreVisible,
  okJson,
} from '@/app/api/trips/_lib/http'
import { quitarControl } from '@/app/api/trips/_lib/texto'
import { calcularSaldos, type GastoGrupo } from '@/lib/grupo/saldos'
import { rateLimit, tooManyRequests } from '@/lib/security/rateLimit'
import type { TripMemberRow } from '@/types/database'

type Ctx = { params: Promise<{ id: string }> }

type Miembro = Pick<TripMemberRow, 'user_id' | 'nombre'>

const MAX_PARTICIPANTES = 200
const NOMBRE_EXMIEMBRO = 'Alguien que ya no está'

const Uuid = z
  .string()
  .regex(UUID_RE)
  .transform((v) => v.toLowerCase())

const ExpenseSchema = z.object({
  concepto: z.string().trim().min(1).max(200),
  monto: z.number().positive().max(10_000_000),
  entre_todos: z.boolean().default(true),
  /** Quién pagó (miembro del viaje). Por defecto, quien lo registra. */
  pagadoPor: Uuid.optional(),
  /** Entre quiénes se reparte (miembros). Por defecto, según entre_todos. */
  participantes: z.array(Uuid).min(1).max(MAX_PARTICIPANTES).optional(),
})

/** Saldo de una persona tal como lo devuelve la API. */
interface SaldoPersonaApi {
  userId: string
  nombre: string
  pagado: number
  parte: number
  neto: number
}

/** «deNombre le debe monto a aNombre». */
interface DeudaApi {
  de: string
  deNombre: string
  a: string
  aNombre: string
  monto: number
}

interface SaldosApi {
  total: number
  personas: SaldoPersonaApi[]
  deudas: DeudaApi[]
}

async function leerMiembros(
  supabase: SupabaseClient,
  tripId: string
): Promise<{ miembros: Miembro[] } | { error: PostgrestError }> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('user_id, nombre')
    .eq('trip_id', tripId)
    .order('joined_at', { ascending: true })
  if (error) return { error }
  return { miembros: (data ?? []) as Miembro[] }
}

/** Saldos simplificados con los nombres ya resueltos. */
function saldosConNombres(
  gastos: readonly GastoGrupo[],
  miembros: readonly Miembro[]
): SaldosApi {
  const nombres = new Map(miembros.map((m) => [m.user_id, m.nombre]))
  for (const g of gastos) {
    if (!nombres.has(g.pagado_por)) nombres.set(g.pagado_por, g.nombre_pagador)
  }
  const nombre = (id: string) => nombres.get(id) ?? NOMBRE_EXMIEMBRO
  const { total, personas, deudas } = calcularSaldos(
    gastos,
    miembros.map((m) => m.user_id)
  )
  return {
    total,
    personas: personas.map((p) => ({ ...p, nombre: nombre(p.userId) })),
    deudas: deudas.map((d) => ({
      de: d.de,
      deNombre: nombre(d.de),
      a: d.a,
      aNombre: nombre(d.a),
      monto: d.monto,
    })),
  }
}

/** Traduce los errores del trigger de validación a respuestas amables. */
function errorDeReparto(error: PostgrestError): Response | null {
  const msg = error.message ?? ''
  if (msg.includes('pagador_no_miembro')) {
    return errorJson(
      400,
      'Quien pagó tiene que ser miembro del grupo.',
      'payer_not_member'
    )
  }
  if (msg.includes('participante_no_miembro')) {
    return errorJson(
      400,
      'Alguien de la lista ya no está en el grupo. Recarga y vuelve a intentarlo.',
      'participant_not_member'
    )
  }
  if (msg.includes('sin_participantes')) {
    return errorJson(
      400,
      'Elige al menos una persona entre las que se reparte el gasto.',
      'no_participants'
    )
  }
  if (error.code === '23514') {
    return errorJson(
      400,
      'Revisa el gasto: necesita un concepto y un monto mayor que cero.',
      'invalid_expense'
    )
  }
  return null
}

/**
 * GET /api/groups/[tripId]/expenses — gastos del grupo en orden cronológico y
 * saldos simplificados (el mínimo de pagos para quedar a mano).
 * Respuesta: {
 *   expenses: GastoGrupo[],
 *   saldos: {
 *     total: number,
 *     personas: { userId, nombre, pagado, parte, neto }[],
 *     deudas: { de, deNombre, a, aNombre, monto }[]   // «de» le debe a «a»
 *   }
 * }
 */
export async function GET(
  request: Request,
  { params }: Ctx
): Promise<Response> {
  const { id } = await params

  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const rechazo = await exigirMiembro(supabase, id)
  if (rechazo) return rechazo

  const [gastos, lectura] = await Promise.all([
    supabase
      .from('group_expenses')
      .select('*')
      .eq('trip_id', id)
      .order('created_at', { ascending: true })
      .limit(500),
    leerMiembros(supabase, id),
  ])

  if (gastos.error) return errorDb(gastos.error, 'groups.expenses.list')
  if ('error' in lectura) return errorDb(lectura.error, 'groups.members')

  const expenses = (gastos.data ?? []) as GastoGrupo[]
  return okJson({
    expenses,
    saldos: saldosConNombres(expenses, lectura.miembros),
  })
}

/**
 * POST /api/groups/[tripId]/expenses — registra un gasto del grupo.
 * Body: {
 *   concepto: string,
 *   monto: number,
 *   entre_todos?: boolean,      // sin participantes: todos o solo quien pagó
 *   pagadoPor?: string,         // user_id de un miembro (por defecto, tú)
 *   participantes?: string[]    // user_id de miembros (por defecto, todos)
 * }
 * Los clientes viejos ({ concepto, monto }) siguen igual: lo pagaste tú y se
 * reparte entre todos.
 * Respuesta 201: { expense: GastoGrupo }
 */
export async function POST(
  request: Request,
  { params }: Ctx
): Promise<Response> {
  const { id } = await params

  const auth = await autenticar(request)
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const limite = await rateLimit({
    bucket: 'group-expense',
    id: user.id,
    limit: 30,
    windowSec: 60,
  })
  if (!limite.ok) return tooManyRequests(limite)

  const leido = await leerJson(request, 16_000)
  if (!leido.ok) return leido.response
  const parsed = ExpenseSchema.safeParse(leido.body)
  if (!parsed.success) {
    const campos = new Set(parsed.error.issues.map((i) => i.path[0]))
    if (campos.has('pagadoPor') || campos.has('participantes')) {
      return errorJson(
        400,
        'Revisa quién pagó y entre quiénes se reparte el gasto.',
        'invalid_split'
      )
    }
    return errorJson(
      400,
      'Revisa el gasto: necesita un concepto y un monto mayor que cero.',
      'invalid_expense'
    )
  }

  const rechazo = await exigirMiembro(supabase, id)
  if (rechazo) return rechazo

  const lectura = await leerMiembros(supabase, id)
  if ('error' in lectura) return errorDb(lectura.error, 'groups.members')
  const miembros = lectura.miembros
  const ids = new Set(miembros.map((m) => m.user_id.toLowerCase()))

  const { concepto, monto, entre_todos, pagadoPor } = parsed.data
  const pagador = pagadoPor ?? user.id.toLowerCase()
  if (pagadoPor && !ids.has(pagadoPor)) {
    return errorJson(
      400,
      'Quien pagó tiene que ser miembro del grupo.',
      'payer_not_member'
    )
  }

  const elegidos = parsed.data.participantes
    ? [...new Set(parsed.data.participantes)]
    : null
  if (elegidos?.some((p) => !ids.has(p))) {
    return errorJson(
      400,
      'Alguien de la lista ya no está en el grupo. Recarga y vuelve a intentarlo.',
      'participant_not_member'
    )
  }
  const participantes =
    elegidos ?? (entre_todos && ids.size > 0 ? [...ids] : [pagador])
  const todos = ids.size > 0 && [...ids].every((m) => participantes.includes(m))

  const nombrePagador =
    miembros.find((m) => m.user_id.toLowerCase() === pagador)?.nombre ??
    (pagador === user.id.toLowerCase() ? nombreVisible(user) : 'Viajero')
  const fila = {
    trip_id: id,
    pagado_por: pagador,
    nombre_pagador: nombrePagador,
    concepto: quitarControl(concepto),
    monto: Math.round(monto * 100) / 100,
    entre_todos: todos,
  }

  const { data, error } = await supabase
    .from('group_expenses')
    .insert({ ...fila, registrado_por: user.id, participantes })
    .select()
    .single()

  if (!error && data) return okJson({ expense: data as GastoGrupo }, 201)

  if (error && esFaltaDeEsquema(error)) {
    // Base sin la migración 20261105140000: solo cabe el reparto de siempre
    // (lo pagaste tú, entre todos o solo para ti).
    const soloYo =
      participantes.length === 1 && participantes[0] === fila.pagado_por
    if (pagador !== user.id.toLowerCase() || !(todos || soloYo)) {
      return errorJson(
        503,
        'Elegir quién pagó y entre quiénes se reparte aún no está disponible. De momento, apunta solo lo que pagaste tú para todo el grupo.',
        'expense_split_unavailable'
      )
    }
    const antiguo = await supabase
      .from('group_expenses')
      .insert({ ...fila, nombre_pagador: nombreVisible(user) })
      .select()
      .single()
    if (antiguo.error || !antiguo.data) {
      return errorDb(antiguo.error, 'groups.expenses.insert')
    }
    return okJson({ expense: antiguo.data as GastoGrupo }, 201)
  }

  if (error) {
    const amable = errorDeReparto(error)
    if (amable) return amable
  }
  return errorDb(error, 'groups.expenses.insert')
}
