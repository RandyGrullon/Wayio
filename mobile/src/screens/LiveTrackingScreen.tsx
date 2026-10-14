import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TripScreen, type CambioEnVivo } from './TripScreen'
import { useNavigation } from '../navigation/NavigationContext'
import { planningTripToLiveTrip } from '../lib/trips/convert'
import { updateTrip } from '../lib/trips/repository'
import { getSupabase } from '../lib/supabase/client'
import { config } from '../config'
import { conFechasReales } from '../lib/geofencing/fechas'
import { actividadesPlanas } from '../lib/geofencing/liveTrip'
import type { Activity } from '../types/activity'
import type { Trip } from '../types/trip'
import type {
  PlanningActivity,
  PlanningDay,
  PlanningTrip,
} from '../types/planning'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MENSAJE_SOLO_DUENO = 'Solo quien creó el viaje puede editarlo.'

/**
 * Lleva el estado del modo en vivo (perdidas, saltadas, reagendadas) al viaje
 * de planificación: estado, día y hora de cada actividad, y la lista «Para tu
 * próxima visita» (actividadesPendientes). Se calcula desde el estado
 * completo, así un guardado que falló se recupera con el siguiente.
 */
export function aplicarAlPlan(plan: PlanningTrip, vivo: Trip): PlanningTrip {
  const enVivo = new Map(actividadesPlanas(vivo).map((a) => [a.id, a]))
  const originales = new Map<string, PlanningActivity>()
  plan.dias.forEach((d) =>
    d.actividades.forEach((a) => originales.set(a.id, a))
  )

  const actualizar = (a: PlanningActivity, v: Activity): PlanningActivity => {
    const base: PlanningActivity = {
      ...a,
      horaInicio: v.horaInicio ?? a.horaInicio,
      horaFin: v.horaFin ?? a.horaFin,
    }
    if (v.estado === 'perdida') {
      return { ...base, estado: 'perdida', esPerdida: true }
    }
    if (v.estado === 'completada') return { ...base, estado: 'completada' }
    // Reagendada (más tarde hoy u otro día): vuelve a estar pendiente.
    if (v.estado === 'pendiente' && (a.estado === 'perdida' || a.esPerdida)) {
      return { ...base, estado: 'pendiente', esPerdida: false }
    }
    return base
  }

  // Cada actividad va al día en que está en el modelo en vivo. Solo se
  // reordenan los días que cambiaron (el orden de la IA se respeta).
  const dias: PlanningDay[] = plan.dias.map((d) => ({ ...d, actividades: [] }))
  const tocados = new Set<number>()
  plan.dias.forEach((d, i) => {
    for (const a of d.actividades) {
      const v = enVivo.get(a.id)
      const destino = v && dias[v.diaIndex] ? v.diaIndex : i
      let actividad = v ? actualizar(a, v) : a
      if (actividad.horaInicio !== a.horaInicio) tocados.add(destino)
      if (v && destino !== i) {
        tocados.add(destino)
        actividad = {
          ...actividad,
          estado: 'pendiente',
          esPerdida: false,
          reagendadaDesdeDia: d.numero,
        }
      }
      dias[destino]?.actividades.push(actividad)
    }
  })
  for (const i of tocados) {
    dias[i]?.actividades.sort((x, y) =>
      (x.horaInicio ?? '').localeCompare(y.horaInicio ?? '')
    )
  }

  // «Para tu próxima visita»: las que siguen perdidas. Las que volvieron al
  // plan (reagendadas) salen; las que solo existen en la lista se conservan.
  const pendientes = (plan.actividadesPendientes ?? []).filter((p) => {
    const v = enVivo.get(p.id)
    return !v || v.estado === 'perdida'
  })
  for (const [id, act] of originales) {
    if (
      enVivo.get(id)?.estado === 'perdida' &&
      !pendientes.some((p) => p.id === id)
    ) {
      pendientes.push({ ...act, estado: 'perdida', esPerdida: true })
    }
  }

  return { ...plan, dias, actividadesPendientes: pendientes }
}

/** id de la fila (trips.id) a partir del id interno del JSON del viaje. */
async function resolverFila(dataId: string): Promise<string | null> {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null
  try {
    const { data, error } = await getSupabase()
      .from('trips')
      .select('id')
      .eq('data->>id', dataId)
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    const id = (data as { id: unknown }).id
    return typeof id === 'string' && UUID_RE.test(id) ? id : null
  } catch {
    return null
  }
}

/**
 * Modo en vivo de un viaje guardado. Convierte el viaje al modelo del motor
 * con el id de FILA (trips.id) y la fecha real de cada día, y guarda en
 * Supabase las decisiones del viajero.
 */
export function LiveTrackingScreen({
  trip,
  tripId,
}: {
  trip: PlanningTrip
  /** id de la fila de Supabase (trips.id). */
  tripId?: string
}): React.ReactElement {
  const { goBack } = useNavigation()
  const filaValida = tripId && UUID_RE.test(tripId) ? tripId : undefined

  const liveTrip = useMemo(
    () =>
      conFechasReales(
        planningTripToLiveTrip(trip, filaValida),
        trip.fechaInicio,
        trip.fechaFin
      ),
    [trip, filaValida]
  )
  const titulos = useMemo(() => trip.dias.map((d) => d.titulo), [trip])

  // Sin id de fila en la ruta, se busca por el id del JSON (para guardar y
  // para reagendar con IA).
  const [filaResuelta, setFilaResuelta] = useState<string | null>(null)
  const fila = useRef<string | null>(filaValida ?? null)
  const plan = useRef<PlanningTrip>(trip)
  useEffect(() => {
    plan.current = trip
    fila.current = filaValida ?? null
    if (filaValida) return
    let vivo = true
    void resolverFila(trip.id).then((id) => {
      if (!vivo || !id) return
      fila.current = id
      setFilaResuelta(id)
    })
    return () => {
      vivo = false
    }
  }, [trip, filaValida])
  const filaId = filaValida ?? filaResuelta ?? undefined

  const persistir = useCallback(
    async (cambio: CambioEnVivo): Promise<string | null> => {
      const id = fila.current
      if (!id) return null
      const nuevo = aplicarAlPlan(plan.current, cambio.trip)
      try {
        await updateTrip(id, {
          data: nuevo,
          actividades_pendientes: nuevo.actividadesPendientes,
        })
        plan.current = nuevo
        return null
      } catch (e) {
        // Solo mensajes pensados para el viajero (nada técnico).
        return e instanceof Error && e.message === MENSAJE_SOLO_DUENO
          ? MENSAJE_SOLO_DUENO
          : 'No pudimos subirlo a tu viaje.'
      }
    },
    []
  )

  // «Para tu próxima visita» que ya traía el viaje (p. ej. desde la web).
  const proximaVisita = useMemo(
    () =>
      (trip.actividadesPendientes ?? []).map((a) => ({
        id: a.id,
        nombre: a.nombre,
      })),
    [trip]
  )

  return (
    <TripScreen
      trip={liveTrip}
      onExit={goBack}
      titulosDias={titulos}
      proximaVisita={proximaVisita}
      {...(filaId ? { filaId } : {})}
      onPersistir={persistir}
    />
  )
}
