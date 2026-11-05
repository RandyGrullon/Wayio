import { useCallback, useMemo, useState } from 'react'
import { getSupabase } from '../../lib/supabase/client'
import type { TripMemberRow } from '../../types/planning'
import type { GastoGrupo } from './saldos'

/** Gasto nuevo con «Pagó» y «Entre quiénes». */
export interface NuevoGasto {
  concepto: string
  monto: number
  /** user_id de quien pagó (un miembro). */
  pagadoPor: string
  /** user_id de los miembros entre los que se reparte. */
  participantes: string[]
}

export interface GastosGrupo {
  /** Gastos de useGroup más los que se están guardando aquí. */
  gastos: GastoGrupo[]
  /** Ids temporales de los gastos que aún no confirmó el servidor. */
  pendientes: ReadonlySet<string>
  /** Error del último gasto (mensaje apto para el usuario). */
  error: string | null
  limpiarError: () => void
  anadir: (nuevo: NuevoGasto) => Promise<boolean>
}

type ErrorDb = { code?: string; message?: string } | null

const PREFIJO_TEMPORAL = 'temp-'

function idTemporal(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  return `${PREFIJO_TEMPORAL}${uuid ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

/** ¿Falta la migración 20261105140000 (columna o tabla desconocida)? */
function faltaMigracion(error: ErrorDb): boolean {
  return ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error?.code ?? '')
}

/** Mensaje amable para un error al guardar el gasto. */
function mensajeDeError(error: ErrorDb): string {
  const msg = error?.message ?? ''
  if (msg.includes('pagador_no_miembro')) {
    return 'Quien pagó tiene que ser miembro del grupo.'
  }
  if (msg.includes('participante_no_miembro')) {
    return 'Alguien de la lista ya no está en el grupo. Recarga y vuelve a intentarlo.'
  }
  if (msg.includes('sin_participantes')) {
    return 'Marca al menos una persona entre las que se reparte el gasto.'
  }
  if (error?.code === '42501') {
    return 'No formas parte de este grupo. Pide a quien organiza el viaje su enlace de invitación.'
  }
  return 'No se pudo guardar el gasto.'
}

/**
 * Alta de gastos con pagador y reparto, optimista, contra Supabase (las RLS
 * y el trigger de la migración validan que todos son miembros). Los gastos
 * «oficiales» siguen llegando por useGroup (carga y Realtime); aquí solo se
 * guardan los que están en camino y los confirmados que useGroup aún no
 * recibió. En cuanto un id aparece en `base`, manda la copia de useGroup (y
 * si luego se borra, no reaparece).
 */
export function useGastosGrupo(
  tripId: string,
  base: readonly GastoGrupo[],
  miembros: readonly TripMemberRow[],
  userId: string
): GastosGrupo {
  const [locales, setLocales] = useState<GastoGrupo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [vistos, setVistos] = useState<ReadonlySet<string>>(
    () => new Set(base.map((g) => g.id))
  )
  const [baseVista, setBaseVista] = useState(base)

  // Ajuste durante el render (patrón de React para derivar de una prop):
  // apunta los ids que ya trajo useGroup.
  if (baseVista !== base) {
    setBaseVista(base)
    const nuevos = base.filter((g) => !vistos.has(g.id))
    if (nuevos.length > 0) {
      setVistos(new Set([...vistos, ...nuevos.map((g) => g.id)]))
    }
  }

  const gastos = useMemo(() => {
    const extra = locales.filter((l) => !vistos.has(l.id))
    return extra.length > 0 ? [...base, ...extra] : [...base]
  }, [base, locales, vistos])

  const pendientes = useMemo<ReadonlySet<string>>(
    () =>
      new Set(
        locales
          .filter((l) => l.id.startsWith(PREFIJO_TEMPORAL))
          .map((l) => l.id)
      ),
    [locales]
  )

  const anadir = useCallback(
    async (nuevo: NuevoGasto): Promise<boolean> => {
      const concepto = nuevo.concepto.trim().slice(0, 200)
      const monto = Math.round(nuevo.monto * 100) / 100
      if (!concepto || !Number.isFinite(monto) || monto <= 0) {
        setError(
          'Revisa el gasto: necesita un concepto y un monto mayor que cero.'
        )
        return false
      }
      const ids = miembros.map((m) => m.user_id)
      const participantes = [...new Set(nuevo.participantes)]
      const todos =
        ids.length > 0 && ids.every((id) => participantes.includes(id))
      const nombreDe = (id: string) =>
        miembros.find((m) => m.user_id === id)?.nombre ?? 'Viajero'
      const fila = {
        trip_id: tripId,
        pagado_por: nuevo.pagadoPor,
        nombre_pagador: nombreDe(nuevo.pagadoPor),
        concepto,
        monto,
        entre_todos: todos,
      }
      const tempId = idTemporal()
      const temporal: GastoGrupo = {
        ...fila,
        id: tempId,
        registrado_por: userId,
        participantes,
        created_at: new Date().toISOString(),
      }
      setError(null)
      setLocales((ls) => [...ls, temporal])
      const fallar = (mensaje: string): false => {
        setLocales((ls) => ls.filter((l) => l.id !== tempId))
        setError(mensaje)
        return false
      }

      try {
        const supabase = getSupabase()
        let resultado = await supabase
          .from('group_expenses')
          .insert({ ...fila, participantes })
          .select()
          .single()

        if (resultado.error && faltaMigracion(resultado.error)) {
          // Servidor sin la migración: solo cabe el reparto de siempre (lo
          // pagaste tú, entre todos o solo para ti).
          const soloYo =
            participantes.length === 1 && participantes[0] === userId
          if (nuevo.pagadoPor !== userId || !(todos || soloYo)) {
            return fallar(
              'Elegir quién pagó y entre quiénes se reparte aún no está disponible. De momento, apunta solo lo que pagaste tú para todo el grupo.'
            )
          }
          resultado = await supabase
            .from('group_expenses')
            .insert(fila)
            .select()
            .single()
        }

        if (resultado.error || !resultado.data) {
          return fallar(mensajeDeError(resultado.error))
        }
        const real = resultado.data as GastoGrupo
        setLocales((ls) => ls.map((l) => (l.id === tempId ? real : l)))
        return true
      } catch {
        return fallar('No se pudo guardar el gasto. Revisa tu conexión.')
      }
    },
    [tripId, miembros, userId]
  )

  const limpiarError = useCallback(() => setError(null), [])

  return { gastos, pendientes, error, limpiarError, anadir }
}
