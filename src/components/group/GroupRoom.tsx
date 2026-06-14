'use client'

import { useState } from 'react'
import { useGroup } from '@/hooks/useGroup'
import { GroupChat } from './GroupChat'
import { ExpenseSplit } from './ExpenseSplit'
import { VotingPanel } from './VotingPanel'
import type { Trip } from '@/types/trip'
import type { User } from '@supabase/supabase-js'

type GroupTab = 'chat' | 'votos' | 'gastos' | 'miembros'

interface GroupRoomProps {
  tripId: string
  trip: Trip
  currentUser: User
}

export function GroupRoom({ tripId, trip, currentUser }: GroupRoomProps) {
  const [tab, setTab] = useState<GroupTab>('chat')
  const {
    members,
    messages,
    votes,
    expenses,
    sendMessage,
    castVote,
    addExpense,
  } = useGroup(tripId)

  const [expenseForm, setExpenseForm] = useState({ concepto: '', monto: '' })

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const monto = parseFloat(expenseForm.monto)
    if (!expenseForm.concepto || isNaN(monto) || monto <= 0) return
    await addExpense(expenseForm.concepto, monto)
    setExpenseForm({ concepto: '', monto: '' })
  }

  const TABS: Array<{ key: GroupTab; label: string }> = [
    { key: 'chat', label: 'Chat' },
    { key: 'votos', label: 'Votos' },
    { key: 'gastos', label: 'Gastos' },
    { key: 'miembros', label: 'Miembros' },
  ]

  // Compute vote summary for all activities
  const allActivities = trip.dias.flatMap((d) => d.actividades)
  const votesByActivity = new Map<string, { si: number; no: number }>()
  for (const act of allActivities) {
    const actVotes = votes.filter((v) => v.activity_id === act.id)
    votesByActivity.set(act.id, {
      si: actVotes.filter((v) => v.voto).length,
      no: actVotes.filter((v) => !v.voto).length,
    })
  }

  // Map expenses to the ExpenseSplit format
  const expensesForSplit = expenses.map((e) => ({
    id: e.id,
    description: e.concepto,
    amount: e.monto,
    currency: 'USD',
    paidBy: e.pagado_por,
    paidByName: e.nombre_pagador,
    splitAmong: e.entre_todos ? members.map((m) => m.user_id) : [e.pagado_por],
  }))

  const membersForSplit = members.map((m) => ({
    id: m.user_id,
    name: m.nombre,
    email: '',
    ...(m.avatar_url !== null ? { avatarUrl: m.avatar_url } : {}),
    preferences: {
      currency: 'USD',
      language: 'es',
      notificationsEnabled: true,
      defaultPackageType: 'standard' as const,
    },
    createdAt: m.joined_at,
  }))

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl bg-surface-muted p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
              tab === key
                ? 'bg-surface text-fg shadow-[var(--shadow-soft)]'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chat */}
      {tab === 'chat' ? (
        <GroupChat
          messages={messages.map((m) => ({
            id: m.id,
            userId: m.user_id,
            userName: m.nombre_usuario,
            text: m.mensaje,
            timestamp: new Date(m.created_at).getTime(),
          }))}
          currentUserId={currentUser.id}
          onSend={sendMessage}
        />
      ) : null}

      {/* Votos */}
      {tab === 'votos' ? (
        <div className="flex flex-col gap-3">
          {allActivities.map((act) => {
            const v = votesByActivity.get(act.id) ?? { si: 0, no: 0 }
            return (
              <VotingPanel
                key={act.id}
                question={`¿Incluir "${act.nombre}"?`}
                options={[
                  { id: `${act.id}:si`, label: 'Sí', votes: v.si },
                  { id: `${act.id}:no`, label: 'No', votes: v.no },
                ]}
                onVote={(optionId) => {
                  const voto = optionId.endsWith(':si')
                  castVote(act.id, voto)
                }}
              />
            )
          })}
        </div>
      ) : null}

      {/* Gastos */}
      {tab === 'gastos' ? (
        <div className="flex flex-col gap-4">
          <form onSubmit={handleAddExpense} className="flex gap-2">
            <input
              type="text"
              placeholder="Concepto (ej: Cena en restaurante)"
              value={expenseForm.concepto}
              onChange={(e) =>
                setExpenseForm((f) => ({ ...f, concepto: e.target.value }))
              }
              required
              className="h-11 min-w-0 flex-1 rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            />
            <input
              type="number"
              placeholder="Monto"
              value={expenseForm.monto}
              onChange={(e) =>
                setExpenseForm((f) => ({ ...f, monto: e.target.value }))
              }
              min={0.01}
              step="0.01"
              required
              className="h-11 w-24 rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            />
            <button
              type="submit"
              className="grad-brand h-11 w-11 shrink-0 rounded-xl text-lg font-bold text-white"
            >
              +
            </button>
          </form>
          {membersForSplit.length > 0 && expensesForSplit.length > 0 ? (
            <ExpenseSplit
              expenses={expensesForSplit}
              members={membersForSplit}
            />
          ) : (
            <p className="text-sm text-fg-subtle">
              Sin gastos registrados aún.
            </p>
          )}
        </div>
      ) : null}

      {/* Miembros */}
      {tab === 'miembros' ? (
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-[var(--shadow-soft)]"
            >
              <div className="grad-brand flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white">
                {m.nombre[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-fg">{m.nombre}</p>
                {m.ultima_ubicacion ? (
                  <p className="text-xs text-fg-subtle">
                    Ubicación actualizada{' '}
                    {new Date(m.ultima_ubicacion).toLocaleTimeString()}
                  </p>
                ) : (
                  <p className="text-xs text-fg-subtle">Sin ubicación</p>
                )}
              </div>
              {m.user_id === currentUser.id ? (
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  Tú
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
