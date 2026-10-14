'use client'

import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { formatFecha } from '@/lib/utils/formatters'
import type { GroupExpenseRow, TripMemberRow } from '@/types/database'
import { ExpenseSplit, formatImporte } from './ExpenseSplit'

const MAX_CONCEPTO = 200
const MAX_MONTO = 10_000_000

/** «1.840,5» o «1,840.50» → 1840.5. null si no es un importe válido. */
function leerMonto(texto: string): number | null {
  const limpio = texto.trim().replace(/\s/g, '')
  if (!limpio) return null
  // Separador decimal: el último punto o coma seguido de 1-2 cifras.
  const m = /^(.*?)[.,](\d{1,2})$/.exec(limpio)
  const entero = (m ? m[1] : limpio)?.replace(/[.,]/g, '') ?? ''
  const decimales = m ? m[2] : ''
  if (!/^\d+$/.test(entero || '0')) return null
  const n = Number(`${entero || '0'}.${decimales || '0'}`)
  return Number.isFinite(n) ? n : null
}

/**
 * Gastos del grupo (docs/DISENO.md §6.8): formulario (concepto y monto en la
 * moneda del viaje; lo pagaste tú y se reparte entre todos), lista con
 * pagador, fecha e importe, y la Card «Balances».
 */
export function GroupExpenses({
  expenses,
  members,
  currentUserId,
  moneda,
  pendingIds,
  addExpense,
}: {
  expenses: GroupExpenseRow[]
  members: TripMemberRow[]
  currentUserId: string
  moneda: string
  pendingIds: ReadonlySet<string>
  addExpense: (concepto: string, monto: number) => Promise<boolean>
}) {
  const conceptoRef = useRef<HTMLInputElement | null>(null)
  const [mostrarForm, setMostrarForm] = useState(expenses.length > 0)
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [errores, setErrores] = useState<{
    concepto?: string
    monto?: string
  }>({})

  const guardar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const c = concepto.trim()
    const n = leerMonto(monto)
    const nuevos: { concepto?: string; monto?: string } = {}
    if (!c) nuevos.concepto = 'Escribe en qué se gastó.'
    if (n === null || n <= 0) nuevos.monto = 'Escribe un monto mayor que cero.'
    else if (n > MAX_MONTO) nuevos.monto = 'Ese monto es demasiado alto.'
    setErrores(nuevos)
    if (nuevos.concepto || nuevos.monto || n === null) return
    setConcepto('')
    setMonto('')
    conceptoRef.current?.focus()
    void addExpense(c.slice(0, MAX_CONCEPTO), Math.round(n * 100) / 100).then(
      (ok) => {
        // Si falló, se devuelven los datos para no perderlos.
        if (!ok) {
          setConcepto((v) => v || c)
          setMonto((v) => v || monto)
        }
      }
    )
  }

  const ordenados = expenses
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="flex flex-col gap-6">
      {mostrarForm || expenses.length > 0 ? (
        <form
          onSubmit={guardar}
          noValidate
          className="rounded-card border border-border bg-surface p-4 md:p-5"
          aria-labelledby="grupo-nuevo-gasto"
        >
          <h2 id="grupo-nuevo-gasto" className="text-title text-fg">
            Añadir un gasto
          </h2>
          <p className="mt-0.5 text-caption text-fg-muted">
            Lo pagaste tú y se reparte a partes iguales entre todo el grupo.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
            <Input
              ref={conceptoRef}
              id="gasto-concepto"
              label="Concepto"
              placeholder="Ej.: Cena en el Malecón"
              value={concepto}
              maxLength={MAX_CONCEPTO}
              onChange={(e) => setConcepto(e.target.value)}
              error={errores.concepto}
              fieldSize="md"
            />
            <Input
              id="gasto-monto"
              label="Monto"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              error={errores.monto}
              fieldSize="md"
              className="tnum"
              suffix={
                <span className="pr-2.5 text-caption font-semibold text-fg-subtle">
                  {moneda}
                </span>
              }
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={<Plus />}
            className="mt-4"
          >
            Añadir gasto
          </Button>
        </form>
      ) : null}

      {expenses.length === 0 ? (
        <EmptyState
          title="Sin gastos todavía"
          description="Apunta lo que cada uno paga y Wayio calcula quién le debe a quién."
          className="py-6"
          action={
            mostrarForm ? undefined : (
              <Button
                variant="primary"
                size="lg"
                icon={<Plus />}
                onClick={() => {
                  setMostrarForm(true)
                  window.requestAnimationFrame(() =>
                    conceptoRef.current?.focus()
                  )
                }}
              >
                Añadir gasto
              </Button>
            )
          }
        />
      ) : (
        <>
          <section aria-labelledby="grupo-lista-gastos">
            <h2 id="grupo-lista-gastos" className="sr-only">
              Gastos registrados
            </h2>
            <ul className="divide-y divide-border rounded-card border border-border bg-surface">
              {ordenados.map((g) => {
                const pendiente = pendingIds.has(g.id)
                const pagador =
                  g.pagado_por === currentUserId ? 'Tú' : g.nombre_pagador
                return (
                  <li
                    key={g.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-fg">
                        {g.concepto}
                      </p>
                      <p className="text-caption text-fg-muted">
                        {pendiente
                          ? 'Guardando…'
                          : `Pagó ${pagador} · ${formatFecha(g.created_at)}`}
                        {g.entre_todos ? '' : ' · Solo quien pagó'}
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-[15px] font-semibold text-fg tnum">
                      {formatImporte(Number(g.monto), moneda)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
          <ExpenseSplit
            expenses={expenses}
            members={members}
            currentUserId={currentUserId}
            moneda={moneda}
          />
        </>
      )}
    </div>
  )
}
