'use client'

import { useCallback, useMemo, useState } from 'react'
import type { GastoGrupo } from '@/lib/grupo/saldos'
import type { TripMemberRow } from '@/types/database'

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

const PREFIJO_TEMPORAL = 'temp-'

function idTemporal(): string {
  const aleatorio =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${PREFIJO_TEMPORAL}${aleatorio}`
}

async function leerError(res: Response, porDefecto: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown }
    return typeof body.error === 'string' ? body.error : porDefecto
  } catch {
    return porDefecto
  }
}

/**
 * Alta de gastos con pagador y reparto (POST /api/groups/[id]/expenses con
 * pagadoPor y participantes), optimista. Los gastos «oficiales» siguen
 * llegando por useGroup (carga y Realtime); aquí solo se guardan los que
 * están en camino y los confirmados que useGroup aún no recibió. En cuanto
 * un id aparece en `base`, manda la copia de useGroup (y si luego se borra,
 * no reaparece).
 */
export function useGastosGrupo(
  tripId: string,
  base: readonly GastoGrupo[],
  miembros: readonly TripMemberRow[],
  currentUserId: string
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
      const tempId = idTemporal()
      const ids = miembros.map((m) => m.user_id)
      const temporal: GastoGrupo = {
        id: tempId,
        trip_id: tripId,
        pagado_por: nuevo.pagadoPor,
        nombre_pagador:
          miembros.find((m) => m.user_id === nuevo.pagadoPor)?.nombre ?? 'Tú',
        registrado_por: currentUserId,
        concepto: nuevo.concepto.trim(),
        monto: nuevo.monto,
        entre_todos: ids.every((id) => nuevo.participantes.includes(id)),
        participantes: nuevo.participantes,
        created_at: new Date().toISOString(),
      }
      setError(null)
      setLocales((ls) => [...ls, temporal])
      const quitar = () => setLocales((ls) => ls.filter((l) => l.id !== tempId))
      try {
        const res = await fetch(`/api/groups/${tripId}/expenses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            concepto: temporal.concepto,
            monto: nuevo.monto,
            pagadoPor: nuevo.pagadoPor,
            participantes: nuevo.participantes,
          }),
        })
        if (!res.ok) {
          setError(await leerError(res, 'No se pudo guardar el gasto.'))
          quitar()
          return false
        }
        const { expense } = (await res.json()) as { expense: GastoGrupo }
        setLocales((ls) => ls.map((l) => (l.id === tempId ? expense : l)))
        return true
      } catch {
        setError('No se pudo guardar el gasto. Revisa tu conexión.')
        quitar()
        return false
      }
    },
    [tripId, miembros, currentUserId]
  )

  const limpiarError = useCallback(() => setError(null), [])

  return { gastos, pendientes, error, limpiarError, anadir }
}
