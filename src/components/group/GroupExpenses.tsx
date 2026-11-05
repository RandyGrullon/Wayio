'use client'

import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ChipGroup } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { FieldMessage } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { participantesDe, type GastoGrupo } from '@/lib/grupo/saldos'
import { formatFecha } from '@/lib/utils/formatters'
import type { TripMemberRow } from '@/types/database'
import { ExpenseSplit, formatImporte, nombresDelGrupo } from './ExpenseSplit'
import type { NuevoGasto } from './useGastosGrupo'

const MAX_CONCEPTO = 200
const MAX_MONTO = 10_000_000

type Errores = {
  concepto?: string | undefined
  monto?: string | undefined
  participantes?: string | undefined
}

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

/** «Ana», «Ana y Luis», «Ana, Luis y tú». */
function enumerar(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? ''
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

/**
 * Gastos del grupo (docs/DISENO.md §6.8): formulario (concepto, monto en la
 * moneda del viaje, «Pagó» y «Entre quiénes»), lista con pagador, reparto,
 * fecha e importe, y la Card «Balances».
 */
export function GroupExpenses({
  expenses,
  members,
  currentUserId,
  moneda,
  pendingIds,
  addExpense,
}: {
  expenses: readonly GastoGrupo[]
  members: readonly TripMemberRow[]
  currentUserId: string
  moneda: string
  pendingIds: ReadonlySet<string>
  addExpense: (nuevo: NuevoGasto) => Promise<boolean>
}) {
  const conceptoRef = useRef<HTMLInputElement | null>(null)
  const [mostrarForm, setMostrarForm] = useState(expenses.length > 0)
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  // null = el valor por defecto (pagas tú · entre todos los miembros, incluso
  // los que se sumen mientras el formulario está abierto).
  const [pagador, setPagador] = useState<string | null>(null)
  const [elegidos, setElegidos] = useState<string[] | null>(null)
  const [errores, setErrores] = useState<Errores>({})

  const ids = members.map((m) => m.user_id)
  const variosMiembros = ids.length > 1
  const nombre = nombresDelGrupo(expenses, members, currentUserId)
  /** Nombre dentro de una frase: «tú» en minúscula. */
  const quien = (id: string) => (id === currentUserId ? 'tú' : nombre(id))

  const pagadorEfectivo =
    pagador && ids.includes(pagador)
      ? pagador
      : ids.includes(currentUserId)
        ? currentUserId
        : (ids[0] ?? currentUserId)
  const participantes =
    elegidos === null ? ids : elegidos.filter((id) => ids.includes(id))
  const todosMarcados =
    ids.length > 0 && ids.every((id) => participantes.includes(id))

  const opciones = members.map((m) => ({
    value: m.user_id,
    label: m.user_id === currentUserId ? 'Tú' : m.nombre,
  }))

  const montoLeido = leerMonto(monto)
  const pistaReparto =
    participantes.length === 1 && participantes[0]
      ? participantes[0] === currentUserId
        ? 'Solo para ti: no se reparte.'
        : `Solo para ${nombre(participantes[0])}: no se reparte.`
      : montoLeido !== null && montoLeido > 0 && participantes.length > 1
        ? `A partes iguales: ${formatImporte(montoLeido / participantes.length, moneda)} por persona.`
        : 'A partes iguales entre las personas marcadas.'

  const guardar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const c = concepto.trim()
    const n = montoLeido
    const reparto = variosMiembros
      ? participantes
      : participantes.length > 0
        ? participantes
        : [pagadorEfectivo]
    const nuevos: Errores = {}
    if (!c) nuevos.concepto = 'Escribe en qué se gastó.'
    if (n === null || n <= 0) nuevos.monto = 'Escribe un monto mayor que cero.'
    else if (n > MAX_MONTO) nuevos.monto = 'Ese monto es demasiado alto.'
    if (reparto.length === 0) {
      nuevos.participantes = 'Marca al menos una persona.'
    }
    setErrores(nuevos)
    if (n === null || nuevos.concepto || nuevos.monto || nuevos.participantes) {
      return
    }

    const antes = { concepto, monto, pagador, elegidos }
    setConcepto('')
    setMonto('')
    setPagador(null)
    setElegidos(null)
    conceptoRef.current?.focus()
    void addExpense({
      concepto: c.slice(0, MAX_CONCEPTO),
      monto: Math.round(n * 100) / 100,
      pagadoPor: pagadorEfectivo,
      participantes: reparto,
    }).then((ok) => {
      // Si falló, se devuelven los datos para no perderlos.
      if (!ok) {
        setConcepto((v) => v || antes.concepto)
        setMonto((v) => v || antes.monto)
        setPagador((v) => v ?? antes.pagador)
        setElegidos((v) => v ?? antes.elegidos)
      }
    })
  }

  /** «Entre todos» · «Solo para Ana» · «Entre Ana, Luis y tú» · «Entre 5». */
  const describirReparto = (g: GastoGrupo): string => {
    const entre = participantesDe(g, ids)
    if (
      ids.length > 1 &&
      entre.length === ids.length &&
      ids.every((id) => entre.includes(id))
    ) {
      return 'Entre todos'
    }
    const [unico] = entre
    if (entre.length === 1 && unico) {
      return unico === currentUserId
        ? 'Solo para ti'
        : `Solo para ${nombre(unico)}`
    }
    if (entre.length <= 3) return `Entre ${enumerar(entre.map(quien))}`
    return `Entre ${entre.length} personas`
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
            {variosMiembros
              ? 'Elige quién pagó y entre quiénes se reparte, a partes iguales.'
              : 'Por ahora solo estás tú: cuando se sume alguien podrás elegir quién pagó y entre quiénes se reparte.'}
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

          {variosMiembros ? (
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <p id="gasto-pagador" className="mb-1.5 text-label text-fg">
                  Pagó
                </p>
                <ChipGroup
                  labelledBy="gasto-pagador"
                  size="sm"
                  options={opciones}
                  value={pagadorEfectivo}
                  onValueChange={setPagador}
                />
              </div>
              <div>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
                  <p id="gasto-participantes" className="text-label text-fg">
                    Entre quiénes
                  </p>
                  {todosMarcados ? null : (
                    <Button
                      variant="link"
                      onClick={() => {
                        setElegidos(null)
                        setErrores((er) => ({
                          ...er,
                          participantes: undefined,
                        }))
                      }}
                    >
                      Marcar a todos
                    </Button>
                  )}
                </div>
                <ChipGroup
                  type="multiple"
                  labelledBy="gasto-participantes"
                  aria-describedby={
                    errores.participantes
                      ? 'gasto-participantes-error'
                      : 'gasto-participantes-hint'
                  }
                  aria-invalid={errores.participantes ? true : undefined}
                  size="sm"
                  options={opciones}
                  value={participantes}
                  onValueChange={(valores) => {
                    const todos = ids.every((id) => valores.includes(id))
                    setElegidos(todos ? null : valores)
                    if (valores.length > 0) {
                      setErrores((er) => ({ ...er, participantes: undefined }))
                    }
                  }}
                />
                <FieldMessage
                  ids={{
                    hintId: 'gasto-participantes-hint',
                    errorId: 'gasto-participantes-error',
                  }}
                  hint={<span className="tnum">{pistaReparto}</span>}
                  error={errores.participantes}
                />
              </div>
            </div>
          ) : null}

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
          description="Apunta quién paga qué y Wayio calcula quién le debe a quién."
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
                const pago =
                  g.pagado_por === currentUserId
                    ? 'Pagaste tú'
                    : `Pagó ${nombre(g.pagado_por)}`
                const apunto =
                  g.registrado_por && g.registrado_por !== g.pagado_por
                    ? ` · Lo apuntó ${quien(g.registrado_por)}`
                    : ''
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
                          : `${pago} · ${formatFecha(g.created_at)}`}
                      </p>
                      <p className="text-caption text-fg-muted">
                        {describirReparto(g)}
                        {apunto}
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
