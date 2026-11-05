import type { GroupExpenseRow } from '@/types/database'

/**
 * Saldos de los gastos del grupo: «quién le debe a quién». Módulo puro (sin
 * servidor ni React): lo usan la API (/api/groups/[id]/expenses) y la sala
 * web. La app móvil tiene la misma lógica en
 * mobile/src/components/group/saldos.ts: si cambias una, cambia la otra.
 *
 * Todo se calcula en céntimos enteros, así la suma de los saldos es siempre
 * exactamente cero y no aparecen deudas de «US$0.01» por redondeos.
 */

/**
 * Fila de group_expenses con las columnas de la migración
 * 20261105140000_gastos_pagador_y_reparto.sql. Son opcionales: con la base
 * sin migrar (o en gastos antiguos sin backfill) no llegan.
 */
export type GastoGrupo = GroupExpenseRow & {
  /** Quién lo apuntó (puede no ser quien pagó). */
  registrado_por?: string | null
  /** Entre quiénes se reparte a partes iguales (user_id de miembros). */
  participantes?: string[] | null
}

/** Datos mínimos de un gasto para repartirlo. */
export type GastoReparto = Pick<
  GastoGrupo,
  'pagado_por' | 'monto' | 'entre_todos' | 'participantes'
>

/** Un pago para saldar cuentas: `de` le debe `monto` a `a`. */
export interface Deuda {
  de: string
  a: string
  monto: number
}

export interface SaldoPersona {
  userId: string
  /** Lo que pagó de su bolsillo. */
  pagado: number
  /** Su parte de los gastos en los que participa. */
  parte: number
  /** pagado − parte: positivo = le deben; negativo = debe. */
  neto: number
}

export interface Saldos {
  /** Suma de todos los gastos. */
  total: number
  /** Una entrada por miembro (y por exmiembro con movimientos). */
  personas: SaldoPersona[]
  /** Pagos mínimos (voraz) para quedar a mano. */
  deudas: Deuda[]
}

const comparar = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** Importe en céntimos enteros (0 si no es un número positivo). */
export function aCentimos(monto: number | string): number {
  const n = Number(monto)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0
}

/**
 * Entre quiénes se reparte un gasto. Si trae participantes, esos (sin
 * duplicados). Si no (gasto de antes de la migración): todos los miembros
 * actuales si era «entre todos», o solo quien pagó.
 */
export function participantesDe(
  gasto: Pick<GastoReparto, 'pagado_por' | 'entre_todos' | 'participantes'>,
  miembros: readonly string[]
): string[] {
  const propios = Array.isArray(gasto.participantes)
    ? [
        ...new Set(
          gasto.participantes.filter(
            (p): p is string => typeof p === 'string' && p.length > 0
          )
        ),
      ]
    : []
  if (propios.length > 0) return propios
  return gasto.entre_todos && miembros.length > 0
    ? [...new Set(miembros)]
    : [gasto.pagado_por]
}

/**
 * Parte de cada participante, en céntimos. Reparto exacto: los céntimos que
 * sobran van de uno en uno a los primeros participantes ordenados por id
 * (US$10 entre 3 → 334, 333 y 333), igual en la web, la API y el móvil.
 */
export function repartirCentimos(
  centimos: number,
  participantes: readonly string[]
): Map<string, number> {
  const ids = [...new Set(participantes)].sort(comparar)
  const partes = new Map<string, number>()
  if (ids.length === 0 || centimos <= 0) return partes
  const base = Math.floor(centimos / ids.length)
  const resto = centimos - base * ids.length
  ids.forEach((id, i) => partes.set(id, base + (i < resto ? 1 : 0)))
  return partes
}

/**
 * Saldos del grupo: cada gasto suma a quien pagó y resta a cada participante
 * su parte; las deudas se resuelven con el mínimo de pagos (voraz: el que
 * más debe le paga al que más le deben), como mucho personas − 1 pagos.
 *
 * @param miembros user_id de los miembros actuales, en el orden de la lista
 *   (se usan para los gastos antiguos «entre todos»).
 */
export function calcularSaldos(
  gastos: readonly GastoReparto[],
  miembros: readonly string[]
): Saldos {
  const pagado = new Map<string, number>()
  const parte = new Map<string, number>()
  const orden: string[] = []
  const anotar = (id: string) => {
    if (!pagado.has(id)) {
      pagado.set(id, 0)
      parte.set(id, 0)
      orden.push(id)
    }
  }
  for (const id of miembros) anotar(id)

  let total = 0
  for (const g of gastos) {
    const centimos = aCentimos(g.monto)
    if (centimos === 0) continue
    total += centimos
    anotar(g.pagado_por)
    pagado.set(g.pagado_por, (pagado.get(g.pagado_por) ?? 0) + centimos)
    const partes = repartirCentimos(centimos, participantesDe(g, miembros))
    for (const [id, c] of partes) {
      anotar(id)
      parte.set(id, (parte.get(id) ?? 0) + c)
    }
  }

  const netos = orden.map((id) => ({
    id,
    neto: (pagado.get(id) ?? 0) - (parte.get(id) ?? 0),
  }))
  const deudores = netos
    .filter((x) => x.neto < 0)
    .map((x) => ({ id: x.id, c: -x.neto }))
    .sort((x, y) => y.c - x.c || comparar(x.id, y.id))
  const acreedores = netos
    .filter((x) => x.neto > 0)
    .map((x) => ({ id: x.id, c: x.neto }))
    .sort((x, y) => y.c - x.c || comparar(x.id, y.id))

  const deudas: Deuda[] = []
  let i = 0
  let j = 0
  while (i < deudores.length && j < acreedores.length) {
    const d = deudores[i]
    const a = acreedores[j]
    if (!d || !a) break
    const c = Math.min(d.c, a.c)
    if (c > 0) deudas.push({ de: d.id, a: a.id, monto: c / 100 })
    d.c -= c
    a.c -= c
    if (d.c === 0) i++
    if (a.c === 0) j++
  }

  return {
    total: total / 100,
    personas: netos.map(({ id, neto }) => ({
      userId: id,
      pagado: (pagado.get(id) ?? 0) / 100,
      parte: (parte.get(id) ?? 0) / 100,
      neto: neto / 100,
    })),
    deudas,
  }
}
