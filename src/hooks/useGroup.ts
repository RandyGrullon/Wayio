'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type {
  TripMemberRow,
  GroupMessageRow,
  GroupExpenseRow,
  ActivityVoteRow,
} from '@/types/database'

interface GroupState {
  members: TripMemberRow[]
  messages: GroupMessageRow[]
  votes: ActivityVoteRow[]
  expenses: GroupExpenseRow[]
  loading: boolean
  /** Error al cargar el grupo (sin acceso, sin conexión...). */
  error: string | null
  /** Error de la última acción (enviar, votar, gasto, ubicación). */
  actionError: string | null
}

export interface UseGroupReturn extends GroupState {
  /** Ids de mensajes/gastos que aún no confirmó el servidor (optimistas). */
  pendingIds: ReadonlySet<string>
  sendMessage: (mensaje: string) => Promise<boolean>
  castVote: (activityId: string, voto: boolean) => Promise<boolean>
  addExpense: (concepto: string, monto: number) => Promise<boolean>
  updateLocation: (lat: number, lng: number) => Promise<boolean>
  reload: () => Promise<void>
  clearActionError: () => void
}

type ConId = { id: string }

const PREFIJO_TEMPORAL = 'temp-'

function idTemporal(): string {
  const aleatorio =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${PREFIJO_TEMPORAL}${aleatorio}`
}

/** Inserta o reemplaza por id (sin duplicar). */
function upsertPorId<T extends ConId>(lista: T[], fila: T): T[] {
  const i = lista.findIndex((x) => x.id === fila.id)
  if (i === -1) return [...lista, fila]
  const copia = lista.slice()
  copia[i] = fila
  return copia
}

/** Cambia la fila temporal por la definitiva (o la descarta si ya llegó). */
function confirmar<T extends ConId>(lista: T[], tempId: string, real: T): T[] {
  const sinTemporal = lista.filter((x) => x.id !== tempId)
  return upsertPorId(sinTemporal, real)
}

async function leerError(res: Response, porDefecto: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown }
    return typeof body.error === 'string' ? body.error : porDefecto
  } catch {
    return porDefecto
  }
}

type Carga =
  | {
      ok: true
      datos: Pick<GroupState, 'members' | 'messages' | 'votes' | 'expenses'>
    }
  | { ok: false; error: string }

/** Pide miembros, chat, votos y gastos del grupo. Nunca lanza. */
async function cargarGrupo(tripId: string): Promise<Carga> {
  try {
    const [membersRes, messagesRes, votesRes, expensesRes] = await Promise.all([
      fetch(`/api/groups/${tripId}`),
      fetch(`/api/groups/${tripId}/messages`),
      fetch(`/api/groups/${tripId}/votes`),
      fetch(`/api/groups/${tripId}/expenses`),
    ])

    const fallida = [membersRes, messagesRes, votesRes, expensesRes].find(
      (r) => !r.ok
    )
    if (fallida) {
      return {
        ok: false,
        error: await leerError(
          fallida,
          'No pudimos cargar el grupo. Inténtalo de nuevo.'
        ),
      }
    }

    const [membersData, messagesData, votesData, expensesData] =
      await Promise.all([
        membersRes.json() as Promise<{ members?: TripMemberRow[] }>,
        messagesRes.json() as Promise<{ messages?: GroupMessageRow[] }>,
        votesRes.json() as Promise<{ votes?: ActivityVoteRow[] }>,
        expensesRes.json() as Promise<{ expenses?: GroupExpenseRow[] }>,
      ])

    return {
      ok: true,
      datos: {
        members: membersData.members ?? [],
        messages: messagesData.messages ?? [],
        votes: votesData.votes ?? [],
        expenses: expensesData.expenses ?? [],
      },
    }
  } catch {
    return {
      ok: false,
      error:
        'No pudimos cargar el grupo. Revisa tu conexión e inténtalo de nuevo.',
    }
  }
}

/**
 * Estado de la sala grupal de un viaje (miembros, chat, votos, gastos) con
 * Realtime de Supabase. Las acciones son OPTIMISTAS: el cambio se ve al
 * instante y se confirma o se deshace con la respuesta del servidor; los
 * eventos realtime se deduplican por id. También refleja los borrados
 * (moderación del admin, alguien que sale del grupo).
 *
 * @param tripId id del viaje (trips.id)
 * @param currentUserId opcional: id del usuario actual (para el voto
 *   optimista). Si no se pasa, se obtiene de la sesión.
 */
export function useGroup(
  tripId: string,
  currentUserId?: string
): UseGroupReturn {
  const [state, setState] = useState<GroupState>({
    members: [],
    messages: [],
    votes: [],
    expenses: [],
    loading: true,
    error: null,
    actionError: null,
  })
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set())
  const userIdRef = useRef<string | null>(currentUserId ?? null)
  // Copia de los votos para calcular el voto optimista fuera del render.
  const votesRef = useRef<ActivityVoteRow[]>([])

  useEffect(() => {
    if (currentUserId) userIdRef.current = currentUserId
  }, [currentUserId])

  useEffect(() => {
    votesRef.current = state.votes
  }, [state.votes])

  const marcarPendiente = useCallback((id: string, pendiente: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (pendiente) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const fallarAccion = useCallback((mensaje: string) => {
    setState((s) => ({ ...s, actionError: mensaje }))
  }, [])

  const aplicarCarga = useCallback((r: Carga) => {
    setState((s) =>
      r.ok
        ? { ...s, ...r.datos, loading: false, error: null }
        : { ...s, loading: false, error: r.error }
    )
  }, [])

  // Carga inicial (el estado ya nace con loading: true)
  useEffect(() => {
    if (!tripId) return
    let cancelado = false
    void cargarGrupo(tripId).then((r) => {
      if (!cancelado) aplicarCarga(r)
    })
    return () => {
      cancelado = true
    }
  }, [tripId, aplicarCarga])

  const load = useCallback(async () => {
    if (!tripId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    aplicarCarga(await cargarGrupo(tripId))
  }, [tripId, aplicarCarga])

  // Realtime (solo si Supabase está configurado; en modo demo no hay grupos)
  useEffect(() => {
    if (!tripId || !isSupabaseConfigured()) return
    const supabase = createClient()

    if (!userIdRef.current) {
      void supabase.auth.getUser().then(({ data }) => {
        if (data.user && !userIdRef.current) userIdRef.current = data.user.id
      })
    }

    const quitarPorId = <T extends ConId>(lista: T[], viejo: unknown) => {
      const id = (viejo as Partial<ConId> | null)?.id
      return id ? lista.filter((x) => x.id !== id) : lista
    }

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
            if (payload.eventType === 'DELETE') {
              return { ...s, members: quitarPorId(s.members, payload.old) }
            }
            const row = payload.new as TripMemberRow
            return { ...s, members: upsertPorId(s.members, row) }
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_messages',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          setState((s) => {
            if (payload.eventType === 'DELETE') {
              return { ...s, messages: quitarPorId(s.messages, payload.old) }
            }
            const row = payload.new as GroupMessageRow
            return { ...s, messages: upsertPorId(s.messages, row) }
          })
        }
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
            if (payload.eventType === 'DELETE') {
              return { ...s, votes: quitarPorId(s.votes, payload.old) }
            }
            const row = payload.new as ActivityVoteRow
            // Un voto optimista (id temporal) del mismo usuario/actividad se
            // sustituye por el real.
            const sinTemporal = s.votes.filter(
              (v) =>
                !(
                  v.id.startsWith(PREFIJO_TEMPORAL) &&
                  v.user_id === row.user_id &&
                  v.activity_id === row.activity_id
                )
            )
            return { ...s, votes: upsertPorId(sinTemporal, row) }
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_expenses',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          setState((s) => {
            if (payload.eventType === 'DELETE') {
              return { ...s, expenses: quitarPorId(s.expenses, payload.old) }
            }
            const row = payload.new as GroupExpenseRow
            return { ...s, expenses: upsertPorId(s.expenses, row) }
          })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [tripId])

  const sendMessage = useCallback(
    async (mensaje: string): Promise<boolean> => {
      const texto = mensaje.trim()
      if (!texto) return false
      const tempId = idTemporal()
      const temporal: GroupMessageRow = {
        id: tempId,
        trip_id: tripId,
        user_id: userIdRef.current ?? '',
        nombre_usuario: 'Tú',
        mensaje: texto,
        tipo: 'mensaje',
        created_at: new Date().toISOString(),
      }
      setState((s) => ({
        ...s,
        actionError: null,
        messages: [...s.messages, temporal],
      }))
      marcarPendiente(tempId, true)
      try {
        const res = await fetch(`/api/groups/${tripId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mensaje: texto }),
        })
        if (!res.ok) {
          const error = await leerError(res, 'No se pudo enviar el mensaje.')
          setState((s) => ({
            ...s,
            actionError: error,
            messages: s.messages.filter((m) => m.id !== tempId),
          }))
          return false
        }
        const { message } = (await res.json()) as { message: GroupMessageRow }
        setState((s) => ({
          ...s,
          messages: confirmar(s.messages, tempId, message),
        }))
        return true
      } catch {
        setState((s) => ({
          ...s,
          messages: s.messages.filter((m) => m.id !== tempId),
        }))
        fallarAccion('No se pudo enviar el mensaje. Revisa tu conexión.')
        return false
      } finally {
        marcarPendiente(tempId, false)
      }
    },
    [tripId, marcarPendiente, fallarAccion]
  )

  const castVote = useCallback(
    async (activityId: string, voto: boolean): Promise<boolean> => {
      const userId = userIdRef.current
      const existente = userId
        ? votesRef.current.find(
            (v) => v.activity_id === activityId && v.user_id === userId
          )
        : undefined
      const optimista: ActivityVoteRow | null = userId
        ? existente
          ? { ...existente, voto }
          : {
              id: idTemporal(),
              trip_id: tripId,
              activity_id: activityId,
              user_id: userId,
              voto,
              created_at: new Date().toISOString(),
            }
        : null
      // Deshace solo este voto (no pisa lo que haya llegado por realtime).
      const deshacer = (votes: ActivityVoteRow[]): ActivityVoteRow[] => {
        if (!optimista) return votes
        return existente
          ? upsertPorId(votes, existente)
          : votes.filter((v) => v.id !== optimista.id)
      }

      setState((s) => ({
        ...s,
        actionError: null,
        votes: optimista ? upsertPorId(s.votes, optimista) : s.votes,
      }))
      try {
        const res = await fetch(`/api/groups/${tripId}/votes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activity_id: activityId, voto }),
        })
        if (!res.ok) {
          const error = await leerError(res, 'No se pudo registrar tu voto.')
          setState((s) => ({
            ...s,
            actionError: error,
            votes: deshacer(s.votes),
          }))
          return false
        }
        const { vote } = (await res.json()) as { vote: ActivityVoteRow }
        setState((s) => ({
          ...s,
          votes: upsertPorId(
            s.votes.filter(
              (v) =>
                !(
                  v.id.startsWith(PREFIJO_TEMPORAL) &&
                  v.user_id === vote.user_id &&
                  v.activity_id === vote.activity_id
                )
            ),
            vote
          ),
        }))
        return true
      } catch {
        setState((s) => ({ ...s, votes: deshacer(s.votes) }))
        fallarAccion('No se pudo registrar tu voto. Revisa tu conexión.')
        return false
      }
    },
    [tripId, fallarAccion]
  )

  const addExpense = useCallback(
    async (concepto: string, monto: number): Promise<boolean> => {
      const tempId = idTemporal()
      const temporal: GroupExpenseRow = {
        id: tempId,
        trip_id: tripId,
        pagado_por: userIdRef.current ?? '',
        nombre_pagador: 'Tú',
        concepto: concepto.trim(),
        monto,
        entre_todos: true,
        created_at: new Date().toISOString(),
      }
      setState((s) => ({
        ...s,
        actionError: null,
        expenses: [...s.expenses, temporal],
      }))
      marcarPendiente(tempId, true)
      try {
        const res = await fetch(`/api/groups/${tripId}/expenses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ concepto, monto }),
        })
        if (!res.ok) {
          const error = await leerError(res, 'No se pudo guardar el gasto.')
          setState((s) => ({
            ...s,
            actionError: error,
            expenses: s.expenses.filter((e) => e.id !== tempId),
          }))
          return false
        }
        const { expense } = (await res.json()) as { expense: GroupExpenseRow }
        setState((s) => ({
          ...s,
          expenses: confirmar(s.expenses, tempId, expense),
        }))
        return true
      } catch {
        setState((s) => ({
          ...s,
          expenses: s.expenses.filter((e) => e.id !== tempId),
        }))
        fallarAccion('No se pudo guardar el gasto. Revisa tu conexión.')
        return false
      } finally {
        marcarPendiente(tempId, false)
      }
    },
    [tripId, marcarPendiente, fallarAccion]
  )

  const updateLocation = useCallback(
    async (lat: number, lng: number): Promise<boolean> => {
      const userId = userIdRef.current
      if (userId) {
        setState((s) => ({
          ...s,
          members: s.members.map((m) =>
            m.user_id === userId
              ? {
                  ...m,
                  lat_actual: lat,
                  lng_actual: lng,
                  ultima_ubicacion: new Date().toISOString(),
                }
              : m
          ),
        }))
      }
      try {
        const res = await fetch(`/api/groups/${tripId}/location`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
        })
        if (!res.ok) {
          fallarAccion(
            await leerError(res, 'No se pudo compartir tu ubicación.')
          )
          return false
        }
        return true
      } catch {
        fallarAccion('No se pudo compartir tu ubicación. Revisa tu conexión.')
        return false
      }
    },
    [tripId, fallarAccion]
  )

  const clearActionError = useCallback(() => {
    setState((s) => ({ ...s, actionError: null }))
  }, [])

  return {
    ...state,
    pendingIds,
    sendMessage,
    castVote,
    addExpense,
    updateLocation,
    reload: load,
    clearActionError,
  }
}
