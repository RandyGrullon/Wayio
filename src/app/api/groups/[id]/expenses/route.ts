import { z } from 'zod'
import { exigirMiembro } from '../../_lib/grupo'
import {
  autenticar,
  errorDb,
  errorJson,
  leerJson,
  nombreVisible,
  okJson,
} from '@/app/api/trips/_lib/http'
import { quitarControl } from '@/app/api/trips/_lib/texto'
import { rateLimit, tooManyRequests } from '@/lib/security/rateLimit'
import type { GroupExpenseRow } from '@/types/database'

type Ctx = { params: Promise<{ id: string }> }

const ExpenseSchema = z.object({
  concepto: z.string().trim().min(1).max(200),
  monto: z.number().positive().max(10_000_000),
  entre_todos: z.boolean().default(true),
})

/**
 * GET /api/groups/[tripId]/expenses — gastos del grupo en orden cronológico.
 * Respuesta: { expenses: GroupExpenseRow[] }
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

  const { data, error } = await supabase
    .from('group_expenses')
    .select('*')
    .eq('trip_id', id)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) return errorDb(error, 'groups.expenses.list')
  return okJson({ expenses: (data ?? []) as GroupExpenseRow[] })
}

/**
 * POST /api/groups/[tripId]/expenses — registra un gasto que pagaste tú.
 * Body: { concepto: string, monto: number, entre_todos?: boolean }
 * Respuesta 201: { expense: GroupExpenseRow }
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

  const leido = await leerJson(request, 4_000)
  if (!leido.ok) return leido.response
  const parsed = ExpenseSchema.safeParse(leido.body)
  if (!parsed.success) {
    return errorJson(
      400,
      'Revisa el gasto: necesita un concepto y un monto mayor que cero.',
      'invalid_expense'
    )
  }

  const rechazo = await exigirMiembro(supabase, id)
  if (rechazo) return rechazo

  const { data, error } = await supabase
    .from('group_expenses')
    .insert({
      trip_id: id,
      pagado_por: user.id,
      nombre_pagador: nombreVisible(user),
      concepto: quitarControl(parsed.data.concepto),
      monto: Math.round(parsed.data.monto * 100) / 100,
      entre_todos: parsed.data.entre_todos,
    })
    .select()
    .single()

  if (error || !data) return errorDb(error, 'groups.expenses.insert')
  return okJson({ expense: data as GroupExpenseRow }, 201)
}
