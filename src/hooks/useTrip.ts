'use client'

import { useState, useCallback, useRef } from 'react'
import type { Trip } from '@/types/trip'
import type { Activity } from '@/types/activity'
import type { TripRow } from '@/types/database'
import { minutosDeHora } from '@/components/trip/tripUtils'

export type MonedaViaje = NonNullable<Trip['moneda']>

/**
 * Motivo del último error de carga, para elegir la salida en pantalla:
 * - `not_found`: el viaje no existe o no lo puedes ver (404);
 * - `forbidden`: el servidor negó el acceso (403);
 * - `auth_required`: hace falta iniciar sesión (401);
 * - `rate_limited`: demasiadas solicitudes seguidas (429);
 * - `server`: cualquier otro fallo del servidor;
 * - `network`: no hubo respuesta (sin conexión o se cortó).
 */
export type TripErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'auth_required'
  | 'rate_limited'
  | 'server'
  | 'network'

/** Hueco libre que devuelve /api/reschedule (día 1-based, horas «HH:mm»). */
export interface HuecoLibre {
  dia: number
  desde: string
  hasta: string
}

/** Nueva hora propuesta para una actividad perdida. */
export interface PropuestaReagenda {
  /** La actividad con su nueva hora (conserva id y coordenadas). */
  activity: Activity
  /** Día (1-based) donde queda la actividad. */
  dia: number
  /** Día (1-based) del que venía. */
  diaOriginal: number
  nota: string
}

/**
 * Respuesta de /api/reschedule. Si falla, `error`, `code` y `motivo` son los
 * del servidor (p. ej. `sin_huecos`, o `ia_no_disponible` con motivo
 * `tope_diario` o `requiere_pro` en el plan Gratis) o `code: 'network'` si no
 * hubo respuesta; `huecos` permite mover la actividad a mano.
 */
export type ResultadoReagenda =
  | ({ ok: true; huecos: HuecoLibre[] } & PropuestaReagenda)
  | {
      ok: false
      /** Mensaje del servidor; null si no llegó uno legible. */
      error: string | null
      code: string | null
      /** Detalle de `ia_no_disponible` ('tope_diario', 'requiere_pro'…). */
      motivo: string | null
      huecos: HuecoLibre[]
    }

interface TripState {
  trip: Trip | null
  tripId: string | null
  grupoLink: string | null
  actividadesPendientes: Activity[]
  /** Moneda de los importes del viaje (USD si el viaje es antiguo). */
  moneda: MonedaViaje
  /** ¿El dueño lo publicó en /viaje-compartido/<id>? */
  isPublic: boolean
  /** ¿El usuario actual es quien creó el viaje? (los miembros solo lo ven) */
  esDueno: boolean
  loading: boolean
  error: string | null
  /** Motivo del error de carga (null si cargó bien). */
  errorCode: TripErrorCode | null
  /** Error del último guardado (null si se guardó bien). */
  saveError: string | null
  saving: boolean
}

export interface UseTripReturn extends TripState {
  loadTrip: () => Promise<void>
  markActivityLost: (activityId: string) => Promise<void>
  /** Pide a /api/reschedule una nueva hora (no cambia nada todavía). */
  rescheduleActivity: (
    activityId: string,
    reason: string
  ) => Promise<ResultadoReagenda>
  /**
   * Mueve la actividad al día `dia` de la propuesta (en orden de hora), la
   * saca de pendientes y guarda. Devuelve true si se guardó.
   */
  acceptReschedule: (propuesta: PropuestaReagenda) => Promise<boolean>
  /**
   * Guarda el viaje completo (y las pendientes, si se pasan) y, si el
   * servidor lo acepta, lo aplica en pantalla. Si falla, deja `saveError`.
   */
  guardarViaje: (data: Trip, pendientes?: Activity[]) => Promise<boolean>
  /** Publica u oculta el viaje en la vista compartida (solo el dueño). */
  setPublic: (tripId: string, isPublic: boolean) => Promise<boolean>
  /** Cambia y guarda la moneda del viaje (solo el dueño). */
  setMoneda: (moneda: MonedaViaje) => Promise<boolean>
}

/** Copia síncrona de lo que se edita, para calcular cambios fuera del render. */
interface Editable {
  tripId: string | null
  trip: Trip | null
  pendientes: Activity[]
}

interface RespuestaReagenda {
  activity?: Activity
  dia?: number
  diaOriginal?: number
  nota?: string
  huecos?: HuecoLibre[]
  error?: unknown
  code?: unknown
  motivo?: unknown
}

async function leerError(res: Response, porDefecto: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown }
    return typeof body.error === 'string' ? body.error : porDefecto
  } catch {
    return porDefecto
  }
}

function codigoPorEstado(status: number): TripErrorCode {
  if (status === 404) return 'not_found'
  if (status === 403) return 'forbidden'
  if (status === 401) return 'auth_required'
  if (status === 429) return 'rate_limited'
  return 'server'
}

/** Día (1-based) donde está la actividad; 1 si no aparece. */
function diaDeActividad(trip: Trip | null, activityId: string): number {
  const i =
    trip?.dias.findIndex((d) =>
      d.actividades.some((a) => a.id === activityId)
    ) ?? -1
  return i >= 0 ? i + 1 : 1
}

/**
 * Mueve una actividad reagendada a su día (1-based) en orden de hora: la saca
 * del día donde estaba y la vuelve pendiente. Si cambia de día guarda
 * `reagendadaDesdeDia`; si no, conserva el que tuviera.
 */
export function moverActividad(
  trip: Trip,
  original: Activity,
  nueva: Activity,
  diaDestino: number,
  diaOriginal: number
): Trip {
  const destino = Math.min(Math.max(1, diaDestino), trip.dias.length) - 1
  // La marca «Movida del día N» la decide este helper, no la propuesta.
  const { reagendadaDesdeDia: _marcaPropuesta, ...propuesta } = nueva
  void _marcaPropuesta
  const actividad: Activity = {
    ...original,
    ...propuesta,
    id: original.id,
    estado: 'pendiente',
    esPerdida: false,
    ...(diaDestino !== diaOriginal
      ? { reagendadaDesdeDia: diaOriginal }
      : original.reagendadaDesdeDia !== undefined
        ? { reagendadaDesdeDia: original.reagendadaDesdeDia }
        : {}),
  }
  const dias = trip.dias.map((d, i) => {
    const sin = d.actividades.filter((a) => a.id !== original.id)
    if (i !== destino)
      return sin.length === d.actividades.length
        ? d
        : { ...d, actividades: sin }
    const lista = [...sin, actividad].sort(
      (x, y) =>
        (minutosDeHora(x.horaInicio) ?? 0) - (minutosDeHora(y.horaInicio) ?? 0)
    )
    return { ...d, actividades: lista }
  })
  return { ...trip, dias }
}

export function useTrip(id: string): UseTripReturn {
  const [state, setState] = useState<TripState>({
    trip: null,
    tripId: null,
    grupoLink: null,
    actividadesPendientes: [],
    moneda: 'USD',
    isPublic: false,
    esDueno: false,
    loading: false,
    error: null,
    errorCode: null,
    saveError: null,
    saving: false,
  })
  const editable = useRef<Editable>({
    tripId: null,
    trip: null,
    pendientes: [],
  })

  /** Aplica un cambio local (estado + copia síncrona). */
  const aplicar = useCallback((trip: Trip, pendientes: Activity[]) => {
    editable.current = { ...editable.current, trip, pendientes }
    setState((s) => ({
      ...s,
      trip,
      actividadesPendientes: pendientes,
      moneda: trip.moneda ?? 'USD',
    }))
  }, [])

  /** PUT parcial del viaje; devuelve true si se guardó. */
  const guardar = useCallback(
    async (cambios: {
      data?: Trip
      actividades_pendientes?: Activity[]
    }): Promise<boolean> => {
      const tripId = editable.current.tripId
      if (!tripId) return false
      setState((s) => ({ ...s, saving: true, saveError: null }))
      try {
        const res = await fetch(`/api/trips/${tripId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cambios),
        })
        if (!res.ok) {
          const error = await leerError(
            res,
            'No pudimos guardar los cambios del viaje.'
          )
          setState((s) => ({ ...s, saving: false, saveError: error }))
          return false
        }
        setState((s) => ({ ...s, saving: false }))
        return true
      } catch {
        setState((s) => ({
          ...s,
          saving: false,
          saveError:
            'No pudimos guardar los cambios. Revisa tu conexión e inténtalo de nuevo.',
        }))
        return false
      }
    },
    []
  )

  const loadTrip = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null, errorCode: null }))
    try {
      const res = await fetch(`/api/trips/${id}`)
      if (!res.ok) {
        const error = await leerError(res, 'No pudimos cargar este viaje.')
        setState((s) => ({
          ...s,
          loading: false,
          error,
          errorCode: codigoPorEstado(res.status),
        }))
        return
      }
      const { trip: row, esDueno } = (await res.json()) as {
        trip: TripRow
        esDueno?: boolean
      }
      const pendientes = row.actividades_pendientes ?? []
      editable.current = { tripId: row.id, trip: row.data, pendientes }
      setState((s) => ({
        ...s,
        trip: row.data,
        tripId: row.id,
        grupoLink: row.grupo_link ?? null,
        actividadesPendientes: pendientes,
        moneda: row.data.moneda ?? 'USD',
        isPublic: row.is_public === true,
        esDueno: esDueno === true,
        loading: false,
        error: null,
        errorCode: null,
      }))
    } catch {
      setState((s) => ({
        ...s,
        loading: false,
        error: 'No pudimos cargar este viaje. Revisa tu conexión.',
        errorCode: 'network',
      }))
    }
  }, [id])

  const markActivityLost = useCallback(
    async (activityId: string) => {
      const { trip, pendientes } = editable.current
      if (!trip) return
      const dias = trip.dias.map((day) => ({
        ...day,
        actividades: day.actividades.map((act) =>
          act.id === activityId
            ? { ...act, estado: 'perdida' as const, esPerdida: true }
            : act
        ),
      }))
      const lostAct = trip.dias
        .flatMap((d) => d.actividades)
        .find((a) => a.id === activityId)
      const yaPendiente = pendientes.some((a) => a.id === activityId)
      const nuevasPendientes =
        lostAct && !yaPendiente ? [...pendientes, lostAct] : pendientes
      const updatedTrip = { ...trip, dias }

      aplicar(updatedTrip, nuevasPendientes)
      await guardar({
        data: updatedTrip,
        actividades_pendientes: nuevasPendientes,
      })
    },
    [aplicar, guardar]
  )

  const rescheduleActivity = useCallback(
    async (activityId: string, reason: string): Promise<ResultadoReagenda> => {
      const tripId = editable.current.tripId
      if (!tripId) {
        return {
          ok: false,
          error: 'Este viaje todavía no está guardado en tu cuenta.',
          code: 'no_guardado',
          motivo: null,
          huecos: [],
        }
      }
      try {
        const res = await fetch('/api/reschedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityId, tripId, reason }),
        })
        const data = (await res.json().catch(() => ({}))) as RespuestaReagenda
        const huecos = Array.isArray(data.huecos) ? data.huecos : []
        if (res.ok && data.activity && typeof data.dia === 'number') {
          return {
            ok: true,
            activity: data.activity,
            dia: data.dia,
            diaOriginal:
              typeof data.diaOriginal === 'number'
                ? data.diaOriginal
                : diaDeActividad(editable.current.trip, activityId),
            nota: typeof data.nota === 'string' ? data.nota : '',
            huecos,
          }
        }
        return {
          ok: false,
          error: typeof data.error === 'string' ? data.error : null,
          code: typeof data.code === 'string' ? data.code : null,
          motivo: typeof data.motivo === 'string' ? data.motivo : null,
          huecos,
        }
      } catch {
        return {
          ok: false,
          error: null,
          code: 'network',
          motivo: null,
          huecos: [],
        }
      }
    },
    []
  )

  const guardarViaje = useCallback(
    async (data: Trip, pendientes?: Activity[]): Promise<boolean> => {
      const ok = await guardar(
        pendientes ? { data, actividades_pendientes: pendientes } : { data }
      )
      if (ok) aplicar(data, pendientes ?? editable.current.pendientes)
      return ok
    },
    [aplicar, guardar]
  )

  const acceptReschedule = useCallback(
    async (propuesta: PropuestaReagenda): Promise<boolean> => {
      const { trip, pendientes } = editable.current
      if (!trip) return false
      const original =
        trip.dias
          .flatMap((d) => d.actividades)
          .find((a) => a.id === propuesta.activity.id) ?? propuesta.activity
      const data = moverActividad(
        trip,
        original,
        propuesta.activity,
        propuesta.dia,
        propuesta.diaOriginal
      )
      return guardarViaje(
        data,
        pendientes.filter((a) => a.id !== original.id)
      )
    },
    [guardarViaje]
  )

  const setPublic = useCallback(
    async (tripId: string, isPublic: boolean): Promise<boolean> => {
      setState((s) => ({ ...s, saveError: null }))
      try {
        const res = await fetch(`/api/trips/${tripId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_public: isPublic }),
        })
        if (!res.ok) {
          const error = await leerError(
            res,
            'No pudimos cambiar cómo se comparte el viaje.'
          )
          setState((s) => ({ ...s, saveError: error }))
          return false
        }
        const { trip } = (await res.json()) as {
          trip: { id: string; is_public: boolean }
        }
        setState((s) =>
          s.tripId === trip.id ? { ...s, isPublic: trip.is_public } : s
        )
        return true
      } catch {
        setState((s) => ({
          ...s,
          saveError:
            'No pudimos cambiar cómo se comparte el viaje. Revisa tu conexión.',
        }))
        return false
      }
    },
    []
  )

  const setMoneda = useCallback(
    async (moneda: MonedaViaje): Promise<boolean> => {
      const { trip, pendientes } = editable.current
      if (!trip) return false
      const data: Trip = { ...trip, moneda }
      aplicar(data, pendientes)
      return guardar({ data })
    },
    [aplicar, guardar]
  )

  return {
    ...state,
    loadTrip,
    markActivityLost,
    rescheduleActivity,
    acceptReschedule,
    guardarViaje,
    setPublic,
    setMoneda,
  }
}
