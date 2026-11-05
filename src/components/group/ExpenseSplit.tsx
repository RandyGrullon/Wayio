import { Card } from '@/components/ui/Card'
import { calcularSaldos, type Deuda, type GastoGrupo } from '@/lib/grupo/saldos'
import { formatCurrency } from '@/lib/utils/formatters'
import type { TripMemberRow } from '@/types/database'

interface ExpenseSplitProps {
  expenses: readonly GastoGrupo[]
  members: readonly TripMemberRow[]
  currentUserId: string
  /** Moneda del viaje (USD, EUR o DOP). */
  moneda: string
}

/** Nombre para alguien que salió del grupo pero aparece en un gasto. */
export const NOMBRE_EXMIEMBRO = 'Alguien que ya no está'

/** Importe con decimales solo si los tiene («US$45» · «US$12.50»). */
export function formatImporte(n: number, moneda: string): string {
  const conCentimos = Math.abs(Math.round(n * 100) % 100) > 0
  return formatCurrency(n, moneda, { decimales: conCentimos })
}

/**
 * Nombres de los miembros (y de los pagadores que ya salieron del grupo,
 * con el nombre guardado en el gasto). Tú eres «Tú».
 */
export function nombresDelGrupo(
  expenses: readonly GastoGrupo[],
  members: readonly TripMemberRow[],
  currentUserId: string
): (id: string) => string {
  const nombres = new Map(members.map((m) => [m.user_id, m.nombre]))
  for (const e of expenses) {
    if (!nombres.has(e.pagado_por)) nombres.set(e.pagado_por, e.nombre_pagador)
  }
  return (id) =>
    id === currentUserId ? 'Tú' : (nombres.get(id) ?? NOMBRE_EXMIEMBRO)
}

/**
 * Card «Balances» (docs/DISENO.md §6.8): cada gasto se reparte a partes
 * iguales entre sus participantes y las deudas se resuelven con el mínimo
 * de pagos, en frases: «Ana le debe US$45 a Luis».
 */
export function ExpenseSplit({
  expenses,
  members,
  currentUserId,
  moneda,
}: ExpenseSplitProps) {
  const nombre = nombresDelGrupo(expenses, members, currentUserId)
  const { deudas, personas, total } = calcularSaldos(
    expenses,
    members.map((m) => m.user_id)
  )
  const yo = personas.find((p) => p.userId === currentUserId)

  const frase = (d: Deuda) => {
    const importe = formatImporte(d.monto, moneda)
    if (d.de === currentUserId) return `Tú le debes ${importe} a ${nombre(d.a)}`
    if (d.a === currentUserId) return `${nombre(d.de)} te debe ${importe}`
    return `${nombre(d.de)} le debe ${importe} a ${nombre(d.a)}`
  }

  return (
    <Card as="section" aria-labelledby="grupo-balances" className="p-5">
      <h2 id="grupo-balances" className="font-display text-h3 text-fg">
        Balances
      </h2>
      <p className="mt-1 text-caption text-fg-muted tnum">
        Total del grupo: {formatImporte(total, moneda)}
        {yo
          ? ` · Tu parte: ${formatImporte(yo.parte, moneda)} · Pagaste ${formatImporte(yo.pagado, moneda)}`
          : ''}
      </p>
      {deudas.length === 0 ? (
        <p className="mt-4 text-body-s text-fg">
          Están a mano: nadie le debe nada a nadie.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2 text-body-s text-fg">
          {deudas.map((d) => (
            <li
              key={`${d.de}-${d.a}`}
              className="rounded-control bg-surface-2 px-3.5 py-2.5 tnum"
            >
              {frase(d)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
