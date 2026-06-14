import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase/client'
import type {
  ActivityVoteRow,
  GroupExpenseRow,
  GroupMessageRow,
  TripMemberRow,
} from '../types/planning'

interface GroupState {
  members: TripMemberRow[]
  messages: GroupMessageRow[]
  votes: ActivityVoteRow[]
  expenses: GroupExpenseRow[]
  loading: boolean
  error: string | null
}

export interface UseGroupReturn extends GroupState {
  sendMessage: (mensaje: string) => Promise<void>
  castVote: (activityId: string, voto: boolean) => Promise<void>
  addExpense: (concepto: string, monto: number) => Promise<void>
}

function userName(user: User): string {
  return (
    (user.user_metadata['full_name'] as string | undefined) ??
    user.email ??
    'Viajero'
  )
}

export function useGroup(tripId: string, user: User): UseGroupReturn {
  const [state, setState] = useState<GroupState>({
    members: [],
    messages: [],
    votes: [],
    expenses: [],
    loading: true,
    error: null,
  })

  // Join + initial load
  useEffect(() => {
    if (!tripId) return
    const supabase = getSupabase()

    const run = async (): Promise<void> => {
      // upsert membership
      await supabase.from('trip_members').upsert(
        {
          trip_id: tripId,
          user_id: user.id,
          nombre: userName(user),
          avatar_url:
            (user.user_metadata['avatar_url'] as string | undefined) ?? null,
        },
        { onConflict: 'trip_id,user_id' }
      )

      const [members, messages, votes, expenses] = await Promise.all([
        supabase
          .from('trip_members')
          .select('*')
          .eq('trip_id', tripId)
          .order('joined_at', { ascending: true }),
        supabase
          .from('group_messages')
          .select('*')
          .eq('trip_id', tripId)
          .order('created_at', { ascending: true }),
        supabase.from('activity_votes').select('*').eq('trip_id', tripId),
        supabase
          .from('group_expenses')
          .select('*')
          .eq('trip_id', tripId)
          .order('created_at', { ascending: true }),
      ])

      setState({
        members: (members.data ?? []) as TripMemberRow[],
        messages: (messages.data ?? []) as GroupMessageRow[],
        votes: (votes.data ?? []) as ActivityVoteRow[],
        expenses: (expenses.data ?? []) as GroupExpenseRow[],
        loading: false,
        error: null,
      })
    }

    run().catch((e: unknown) =>
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Error cargando el grupo',
      }))
    )
  }, [tripId, user])

  // Realtime
  useEffect(() => {
    if (!tripId) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`group:${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_members',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          setState((s) => {
            const row = payload.new as TripMemberRow
            if (payload.eventType === 'INSERT')
              return { ...s, members: [...s.members, row] }
            if (payload.eventType === 'UPDATE')
              return {
                ...s,
                members: s.members.map((m) => (m.id === row.id ? row : m)),
              }
            return s
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) =>
          setState((s) => ({
            ...s,
            messages: [...s.messages, payload.new as GroupMessageRow],
          }))
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_votes',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          setState((s) => {
            const row = payload.new as ActivityVoteRow
            if (payload.eventType === 'INSERT')
              return { ...s, votes: [...s.votes, row] }
            if (payload.eventType === 'UPDATE')
              return {
                ...s,
                votes: s.votes.map((v) => (v.id === row.id ? row : v)),
              }
            return s
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_expenses',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) =>
          setState((s) => ({
            ...s,
            expenses: [...s.expenses, payload.new as GroupExpenseRow],
          }))
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [tripId])

  const sendMessage = useCallback(
    async (mensaje: string) => {
      await getSupabase()
        .from('group_messages')
        .insert({
          trip_id: tripId,
          user_id: user.id,
          nombre_usuario: userName(user),
          mensaje,
          tipo: 'mensaje',
        })
    },
    [tripId, user]
  )

  const castVote = useCallback(
    async (activityId: string, voto: boolean) => {
      await getSupabase().from('activity_votes').upsert(
        {
          trip_id: tripId,
          activity_id: activityId,
          user_id: user.id,
          voto,
        },
        { onConflict: 'trip_id,activity_id,user_id' }
      )
    },
    [tripId, user]
  )

  const addExpense = useCallback(
    async (concepto: string, monto: number) => {
      await getSupabase()
        .from('group_expenses')
        .insert({
          trip_id: tripId,
          pagado_por: user.id,
          nombre_pagador: userName(user),
          concepto,
          monto,
          entre_todos: true,
        })
    },
    [tripId, user]
  )

  return { ...state, sendMessage, castVote, addExpense }
}
