import { useCallback, useEffect, useRef, useState } from 'react'
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
  /** Error al cargar el grupo (sin acceso, sin conexión...). */
  error: string | null
  /** Error de la última acción (enviar, votar, gasto). */
  actionError: string | null
}

export interface UseGroupReturn extends GroupState {
  sendMessage: (mensaje: string) => Promise<boolean>
  castVote: (activityId: string, voto: boolean) => Promise<boolean>
  addExpense: (concepto: string, monto: number) => Promise<boolean>
  reload: () => Promise<void>
  clearActionError: () => void
}

type ConId = { id: string }

const PREFIJO_TEMPORAL = 'temp-'
const LIMITE_MENSAJES = 100

/** Nombre que verán los demás miembros (nunca el email completo). */
function nombreVisible(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const nombre =
    (typeof meta?.['full_name'] === 'string' && meta['full_name'].trim()) ||
    (typeof meta?.['name'] === 'string' && meta['name'].trim()) ||
    (user.email ? user.email.split('@')[0] : '') ||
    'Viajero'
  return String(nombre).slice(0, 80)
}

function idTemporal(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  return `${PREFIJO_TEMPORAL}${uuid ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

/** Inserta o reemplaza por id (sin duplicar). */
function upsertPorId<T extends ConId>(lista: T[], fila: T): T[] {
  const i = lista.findIndex((x) => x.id === fila.id)
  if (i === -1) return [...lista, fila]
  const copia = lista.slice()
  copia[i] = fila
  return copia
}

function quitarPorId<T extends ConId>(lista: T[], viejo: unknown): T[] {
  const id = (viejo as Partial<ConId> | null)?.id
  return id ? lista.filter((x) => x.id !== id) : lista
}

/** Cambia la fila temporal por la definitiva (o la descarta si ya llegó). */
function confirmar<T extends ConId>(lista: T[], tempId: string, real: T): T[] {
  return upsertPorId(
    lista.filter((x) => x.id !== tempId),
    real
  )
}

/** Mensaje amable para un error de Supabase. */
function mensajeDeError(
  error: { code?: string; message?: string } | null,
  porDefecto: string
): string {
  if (error?.code === '42501') {
    return 'No formas parte de este grupo. Pide a quien organiza el viaje su enlace de invitación.'
  }
  return porDefecto
}

type Carga =
  | {
      ok: true
      datos: Pick<GroupState, 'members' | 'messages' | 'votes' | 'expenses'>
    }
  | { ok: false; error: string }

/** Comprueba el acceso y carga los datos del grupo. Nunca lanza. */
async function cargarGrupo(tripId: string, userId: string): Promise<Carga> {
  try {
    const supabase = getSupabase()

    // 1. Acceso: si no veo el viaje (RLS), no soy dueño ni miembro.
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, user_id, grupo_link')
      .eq('id', tripId)
      .maybeSingle()
    if (tripError) {
      return {
        ok: false,
        error: mensajeDeError(
          tripError,
          'No pudimos cargar el grupo. Inténtalo de nuevo.'
        ),
      }
    }
    if (!trip) {
      return {
        ok: false,
        error:
          'No tienes acceso a este grupo. Pide a quien organiza el viaje su enlace de invitación.',
      }
    }

    // 2. Garantiza la fila de miembro del DUEÑO (idempotente; viajes antiguos).
    //    Solo para el dueño: un admin que abre el grupo (la RLS le deja ver
    //    el viaje) no debe quedar dado de alta como miembro. Si falla no
    //    impide ver el grupo.
    const fila = trip as { user_id: string; grupo_link: string | null }
    if (fila.user_id === userId && fila.grupo_link) {
      await supabase.rpc('join_trip', { p_link: fila.grupo_link })
    }

    // 3. Datos del grupo (los 100 mensajes más recientes, en orden)
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
        .order('created_at', { ascending: false })
        .limit(LIMITE_MENSAJES),
      supabase.from('activity_votes').select('*').eq('trip_id', tripId),
      supabase
        .from('group_expenses')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true }),
    ])

    const fallida = [members, messages, votes, expenses].find((r) => r.error)
    if (fallida?.error) {
      return {
        ok: false,
        error: mensajeDeError(
          fallida.error,
          'No pudimos cargar el grupo. Inténtalo de nuevo.'
        ),
      }
    }

    return {
      ok: true,
      datos: {
        members: (members.data ?? []) as TripMemberRow[],
        messages: ((messages.data ?? []) as GroupMessageRow[]).reverse(),
        votes: (votes.data ?? []) as ActivityVoteRow[],
        expenses: (expenses.data ?? []) as GroupExpenseRow[],
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
 * Sala grupal de un viaje en mobile (miembros, chat, votos y gastos) con
 * Supabase Realtime. La seguridad la ponen las RLS por membresía: solo los
 * miembros ven y escriben. Ya NO hace un upsert libre en trip_members (eso
 * dejaba unirse a cualquier viaje): la membresía se garantiza con la RPC
 * join_trip usando el enlace del viaje, que solo ve quien ya tiene acceso.
 * Para unirse por invitación usa joinTripByLink (lib/trips/repository).
 *
 * Las acciones son optimistas y los eventos realtime se deduplican por id;
 * también se reflejan los borrados.
 */
export function useGroup(tripId: string, user: User): UseGroupReturn {
  const [state, setState] = useState<GroupState>({
    members: [],
    messages: [],
    votes: [],
    expenses: [],
    loading: true,
    error: null,
    actionError: null,
  })
  const userRef = useRef(user)
  const votesRef = useRef<ActivityVoteRow[]>([])
  const userId = user.id

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    votesRef.current = state.votes
  }, [state.votes])

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

  // Carga inicial: solo cuando cambia el viaje o la cuenta (no con cada
  // refresco de token, que cambia el objeto user).
  useEffect(() => {
    if (!tripId || !userId) return
    let cancelado = false
    void cargarGrupo(tripId, userId).then((r) => {
      if (!cancelado) aplicarCarga(r)
    })
    return () => {
      cancelado = true
    }
  }, [tripId, userId, aplicarCarga])

  const reload = useCallback(async () => {
    if (!tripId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    aplicarCarga(await cargarGrupo(tripId, userId))
  }, [tripId, userId, aplicarCarga])

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
          setState((s) =>
            payload.eventType === 'DELETE'
              ? { ...s, members: quitarPorId(s.members, payload.old) }
              : {
                  ...s,
                  members: upsertPorId(s.members, payload.new as TripMemberRow),
                }
          )
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
          setState((s) =>
            payload.eventType === 'DELETE'
              ? { ...s, messages: quitarPorId(s.messages, payload.old) }
              : {
                  ...s,
                  messages: upsertPorId(
                    s.messages,
                    payload.new as GroupMessageRow
                  ),
                }
          )
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
          setState((s) =>
            payload.eventType === 'DELETE'
              ? { ...s, expenses: quitarPorId(s.expenses, payload.old) }
              : {
                  ...s,
                  expenses: upsertPorId(
                    s.expenses,
                    payload.new as GroupExpenseRow
                  ),
                }
          )
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [tripId])

  const sendMessage = useCallback(
    async (mensaje: string): Promise<boolean> => {
      const texto = mensaje.trim().slice(0, 1000)
      if (!texto) return false
      const u = userRef.current
      const tempId = idTemporal()
      const temporal: GroupMessageRow = {
        id: tempId,
        trip_id: tripId,
        user_id: u.id,
        nombre_usuario: nombreVisible(u),
        mensaje: texto,
        tipo: 'mensaje',
        created_at: new Date().toISOString(),
      }
      setState((s) => ({
        ...s,
        actionError: null,
        messages: [...s.messages, temporal],
      }))

      const { data, error } = await getSupabase()
        .from('group_messages')
        .insert({
          trip_id: tripId,
          user_id: u.id,
          nombre_usuario: temporal.nombre_usuario,
          mensaje: texto,
          tipo: 'mensaje',
        })
        .select()
        .single()

      if (error || !data) {
        setState((s) => ({
          ...s,
          messages: s.messages.filter((m) => m.id !== tempId),
        }))
        fallarAccion(mensajeDeError(error, 'No se pudo enviar el mensaje.'))
        return false
      }
      setState((s) => ({
        ...s,
        messages: confirmar(s.messages, tempId, data as GroupMessageRow),
      }))
      return true
    },
    [tripId, fallarAccion]
  )

  const castVote = useCallback(
    async (activityId: string, voto: boolean): Promise<boolean> => {
      const u = userRef.current
      const existente = votesRef.current.find(
        (v) => v.activity_id === activityId && v.user_id === u.id
      )
      const optimista: ActivityVoteRow = existente
        ? { ...existente, voto }
        : {
            id: idTemporal(),
            trip_id: tripId,
            activity_id: activityId,
            user_id: u.id,
            voto,
            created_at: new Date().toISOString(),
          }
      setState((s) => ({
        ...s,
        actionError: null,
        votes: upsertPorId(s.votes, optimista),
      }))

      const { data, error } = await getSupabase()
        .from('activity_votes')
        .upsert(
          { trip_id: tripId, activity_id: activityId, user_id: u.id, voto },
          { onConflict: 'trip_id,activity_id,user_id' }
        )
        .select()
        .single()

      if (error || !data) {
        setState((s) => ({
          ...s,
          votes: existente
            ? upsertPorId(s.votes, existente)
            : s.votes.filter((v) => v.id !== optimista.id),
        }))
        fallarAccion(mensajeDeError(error, 'No se pudo registrar tu voto.'))
        return false
      }
      const real = data as ActivityVoteRow
      setState((s) => ({
        ...s,
        votes: upsertPorId(
          s.votes.filter((v) => v.id !== optimista.id || v.id === real.id),
          real
        ),
      }))
      return true
    },
    [tripId, fallarAccion]
  )

  const addExpense = useCallback(
    async (concepto: string, monto: number): Promise<boolean> => {
      const limpio = concepto.trim().slice(0, 200)
      if (!limpio || !Number.isFinite(monto) || monto <= 0) {
        fallarAccion(
          'Revisa el gasto: necesita un concepto y un monto mayor que cero.'
        )
        return false
      }
      const u = userRef.current
      const tempId = idTemporal()
      const importe = Math.round(monto * 100) / 100
      const temporal: GroupExpenseRow = {
        id: tempId,
        trip_id: tripId,
        pagado_por: u.id,
        nombre_pagador: nombreVisible(u),
        concepto: limpio,
        monto: importe,
        entre_todos: true,
        created_at: new Date().toISOString(),
      }
      setState((s) => ({
        ...s,
        actionError: null,
        expenses: [...s.expenses, temporal],
      }))

      const { data, error } = await getSupabase()
        .from('group_expenses')
        .insert({
          trip_id: tripId,
          pagado_por: u.id,
          nombre_pagador: temporal.nombre_pagador,
          concepto: limpio,
          monto: importe,
          entre_todos: true,
        })
        .select()
        .single()

      if (error || !data) {
        setState((s) => ({
          ...s,
          expenses: s.expenses.filter((e) => e.id !== tempId),
        }))
        fallarAccion(mensajeDeError(error, 'No se pudo guardar el gasto.'))
        return false
      }
      setState((s) => ({
        ...s,
        expenses: confirmar(s.expenses, tempId, data as GroupExpenseRow),
      }))
      return true
    },
    [tripId, fallarAccion]
  )

  const clearActionError = useCallback(() => {
    setState((s) => ({ ...s, actionError: null }))
  }, [])

  return {
    ...state,
    sendMessage,
    castVote,
    addExpense,
    reload,
    clearActionError,
  }
}
