import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils/formatters'
import type { GroupExpenseRow, TripMemberRow } from '@/types/database'

interface ExpenseSplitProps {
  expenses: GroupExpenseRow[]
  members: TripMemberRow[]
  currentUserId: string
  /** Moneda del viaje (USD, EUR o DOP). */
  moneda: string
}

interface Transferencia {
  de: string
  a: string
  monto: number
}

const CENTIMO = 0.005

/** Importe con decimales solo si los tiene («US$45» · «US$12.50»). */
export function formatImporte(n: number, moneda: string): string {
  const conCentimos = Math.abs(Math.round(n * 100) % 100) > 0
  return formatCurrency(n, moneda, { decimales: conCentimos })
}

/**
 * Saldos del grupo: cada gasto se reparte a partes iguales entre todos los
 * miembros (o solo lo asume quien pagó si no es «entre todos») y las deudas
 * se resuelven con el mínimo de pagos (voraz).
 */
export function calcularSaldos(
  expenses: GroupExpenseRow[],
  members: TripMemberRow[]
): { saldos: Map<string, number>; pagos: Transferencia[]; total: number } {
  const saldos = new Map<string, number>()
  for (const m of members) saldos.set(m.user_id, 0)
  const todos = members.map((m) => m.user_id)
  let total = 0

  for (const e of expenses) {
    const monto = Number(e.monto)
    if (!Number.isFinite(monto) || monto <= 0) continue
    total += monto
    const entre = e.entre_todos && todos.length > 0 ? todos : [e.pagado_por]
    const parte = monto / entre.length
    saldos.set(e.pagado_por, (saldos.get(e.pagado_por) ?? 0) + monto)
    for (const id of entre) saldos.set(id, (saldos.get(id) ?? 0) - parte)
  }

  const deudores = [...saldos.entries()]
    .filter(([, s]) => s < -CENTIMO)
    .map(([id, s]) => ({ id, s: -s }))
    .sort((x, y) => y.s - x.s)
  const acreedores = [...saldos.entries()]
    .filter(([, s]) => s > CENTIMO)
    .map(([id, s]) => ({ id, s }))
    .sort((x, y) => y.s - x.s)

  const pagos: Transferencia[] = []
  let i = 0
  let j = 0
  while (i < deudores.length && j < acreedores.length) {
    const d = deudores[i]
    const c = acreedores[j]
    if (!d || !c) break
    const monto = Math.min(d.s, c.s)
    if (monto > CENTIMO) {
      pagos.push({ de: d.id, a: c.id, monto: Math.round(monto * 100) / 100 })
    }
    d.s -= monto
    c.s -= monto
    if (d.s <= CENTIMO) i++
    if (c.s <= CENTIMO) j++
  }
  return { saldos, pagos, total }
}

/** Card «Balances» con frases: «Ana le debe US$45 a Luis». */
export function ExpenseSplit({
  expenses,
  members,
  currentUserId,
  moneda,
}: ExpenseSplitProps) {
  const nombres = new Map(members.map((m) => [m.user_id, m.nombre]))
  for (const e of expenses) {
    if (!nombres.has(e.pagado_por)) nombres.set(e.pagado_por, e.nombre_pagador)
  }
  const nombre = (id: string) =>
    id === currentUserId ? 'Tú' : (nombres.get(id) ?? 'Alguien')

  const { pagos, total } = calcularSaldos(expenses, members)
  const porPersona = members.length > 0 ? total / members.length : total

  const frase = (p: Transferencia) => {
    const importe = formatImporte(p.monto, moneda)
    if (p.de === currentUserId) return `Tú le debes ${importe} a ${nombre(p.a)}`
    if (p.a === currentUserId) return `${nombre(p.de)} te debe ${importe}`
    return `${nombre(p.de)} le debe ${importe} a ${nombre(p.a)}`
  }

  return (
    <Card as="section" aria-labelledby="grupo-balances" className="p-5">
      <h2 id="grupo-balances" className="font-display text-h3 text-fg">
        Balances
      </h2>
      <p className="mt-1 text-caption text-fg-muted tnum">
        Total del grupo: {formatImporte(total, moneda)}
        {members.length > 1
          ? ` · ${formatImporte(porPersona, moneda)} por persona`
          : ''}
      </p>
      {pagos.length === 0 ? (
        <p className="mt-4 text-body-s text-fg">
          Están a mano: nadie le debe nada a nadie.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2 text-body-s text-fg">
          {pagos.map((p) => (
            <li
              key={`${p.de}-${p.a}`}
              className="rounded-control bg-surface-2 px-3.5 py-2.5 tnum"
            >
              {frase(p)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
