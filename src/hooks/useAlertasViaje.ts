'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
} from 'react'
import type { Activity } from '@/types/activity'
import type { UserLocation } from '@/types/geofencing'
import { guardarDia, leerDia, type DiaGuardado } from '@/lib/alertas/almacen'
import {
  evaluarLlegadas,
  lecturaPrecisa,
  type CambioLlegada,
  type EstadoLlegada,
} from '@/lib/alertas/geocercas'
import { fechaISO, minutosDelDia } from '@/lib/alertas/horas'
import {
  actividadRecomendada,
  pedirMensajeAlerta,
  type MensajeAlerta,
} from '@/lib/alertas/mensaje'
import { notificarSiOculta, puedeNotificar } from '@/lib/alertas/notificar'
import {
  SIN_RETRASO,
  claveRetraso,
  evaluarRetraso,
  restantesTrasActividad,
  type NivelRetraso,
} from '@/lib/alertas/retraso'
import {
  leerRegreso,
  regresoEnServidor,
  suscribirRegreso,
} from '@/lib/alertas/visibilidad'

/**
 * Avisos al llegar y alertas de demora del viaje en vivo en la web, en
 * primer plano (el navegador no vigila en segundo plano). Es la versión web
 * de useGeofencing + useAlertEngine de la app:
 *
 * - Sin posición del GPS (apagado, sin permiso o sin señal) no hace nada.
 * - Solo vale una lectura reciente (≤ 2 min y no anterior a la carga): ni la
 *   que useGPS conserva al reactivarlo ni la de anoche al cambiar de día.
 * - Las demoras se vigilan desde la primera lectura precisa (≤ 150 m) tras
 *   activar el GPS, tras volver de una ausencia larga o tras lecturas
 *   imprecisas; con la última lectura imprecisa, o al volver hasta que llega
 *   una nueva, se pausan (no se sabe si ya estás en el sitio).
 * - Con cada posición detecta llegadas y salidas en las paradas de HOY
 *   (lib/alertas/geocercas) y con cada minuto calcula el nivel de demora
 *   (lib/alertas/retraso).
 * - Nivel 3: pide una vez el mensaje a /api/alert-message (el servidor decide
 *   si es con IA según el plan) y, si falla, usa un texto fijo.
 * - Sin spam: lo descartado no vuelve (misma actividad y nivel), «Seguir
 *   igual» calla esa actividad hoy y se recuerda en este navegador al recargar.
 * - Notificación del sistema solo si ya hay permiso y la pestaña está oculta:
 *   al llegar a una parada y al subir a nivel 3 o 4 (como mucho una cada 10
 *   min, nunca dos del mismo nivel).
 */

const MAX_EVENTOS = 10
const MAX_CLAVES = 200
const NIVEL_MIN_NOTIFICACION = 3
const ENTRE_NOTIFICACIONES_MS = 10 * 60_000
/** Una lectura más vieja no dice dónde estás ahora. */
const MAX_EDAD_LECTURA_MS = 2 * 60_000
/** Tolerancia con la lectura que activó el GPS (maximumAge de useGPS: 5 s). */
const MARGEN_CARGA_MS = 15_000

export interface EventoLlegada extends CambioLlegada {
  /** Creciente en toda la visita: sirve para no repetir avisos. */
  seq: number
}

export interface AlertaRetraso {
  /** actividad:nivel. */
  clave: string
  nivel: Exclude<NivelRetraso, 0>
  retrasoMinutos: number
  actividad: Activity
  /** Lo que queda hoy después de ella, en orden. */
  restantes: Activity[]
}

export interface UseAlertasViajeParams {
  /** Id del viaje (para recordar el día en este navegador). */
  tripId: string
  /** Actividades de HOY; null/undefined si hoy no hay viaje. */
  actividades: readonly Activity[] | null | undefined
  /** Posición del GPS solo cuando está activo; sin ella no se hace nada. */
  ubicacion: UserLocation | null | undefined
  /** Reloj de la pantalla (null en el servidor y en la hidratación). */
  ahora: Date | null
  esCrucero: boolean
}

export interface UseAlertasViajeReturn {
  /** true si el GPS está activo y hay actividades hoy. */
  activo: boolean
  /** Alerta de demora vigente (null si no hay o se cerró). */
  alerta: AlertaRetraso | null
  /** Mensaje del nivel 3 (null mientras llega o en otros niveles). */
  mensaje: MensajeAlerta | null
  /** Actividad que el mensaje propone quitar (ya validada contra hoy). */
  recomendada: Activity | null
  /** Llegadas y salidas recientes (la más nueva primero). */
  eventos: readonly EventoLlegada[]
  /** Cierra esa alerta: la misma actividad y nivel no vuelven hoy. */
  descartar: (clave: string) => void
  /** «Seguir igual»: no volver a avisar de esa actividad hoy. */
  omitir: (actividadId: string) => void
}

interface Estado {
  /** `${tripId}:${fecha}` cargado (null hasta la primera carga). */
  alcance: string | null
  llegadas: Readonly<Record<string, EstadoLlegada>>
  omitidas: readonly string[]
  descartadas: readonly string[]
  eventos: readonly EventoLlegada[]
  seq: number
  /** ms en que se cargó el día (al activar el GPS o cambiar de día). */
  cargadoEn: number
  /** Minuto del día desde el que se vigilan las demoras (null = aún no). */
  desdeMin: number | null
  /** ms (reloj local) de la última lectura precisa aceptada. */
  precisaEn: number
  /** ¿La última lectura aceptada era precisa? */
  ultimaPrecisa: boolean
  mensajes: Readonly<Record<string, MensajeAlerta>>
}

type Accion =
  | { type: 'CARGAR'; alcance: string; guardado: DiaGuardado; ahoraMs: number }
  | {
      type: 'POSICION'
      alcance: string
      actividades: readonly Activity[]
      posicion: UserLocation
      /** ms de la lectura del GPS. */
      momento: number
      /** ms del reloj local al procesarla. */
      ahoraMs: number
      /** Último regreso tras una ausencia larga (lib/alertas/visibilidad). */
      regreso: number
    }
  | { type: 'DESCARTAR'; clave: string }
  | { type: 'OMITIR'; id: string }
  | { type: 'MENSAJE'; clave: string; mensaje: MensajeAlerta }

const INICIAL: Estado = {
  alcance: null,
  llegadas: {},
  omitidas: [],
  descartadas: [],
  eventos: [],
  seq: 0,
  cargadoEn: 0,
  desdeMin: null,
  precisaEn: 0,
  ultimaPrecisa: false,
  mensajes: {},
}

const SIN_EVENTOS: readonly EventoLlegada[] = []

const agregar = (lista: readonly string[], valor: string): string[] =>
  [...lista.filter((v) => v !== valor), valor].slice(-MAX_CLAVES)

function reducer(state: Estado, action: Accion): Estado {
  switch (action.type) {
    case 'CARGAR':
      // Al activar el GPS (o cambiar de día) se empieza a vigilar de nuevo:
      // lo que pasó mientras estaba apagado no se sabe.
      return {
        ...state,
        alcance: action.alcance,
        llegadas: action.guardado.llegadas,
        omitidas: action.guardado.omitidas,
        descartadas: action.guardado.descartadas,
        eventos: [],
        cargadoEn: action.ahoraMs,
        desdeMin: null,
        precisaEn: 0,
        ultimaPrecisa: false,
      }

    case 'POSICION': {
      if (state.alcance !== action.alcance) return state
      const { momento, ahoraMs, regreso } = action
      // Lectura vieja (la que useGPS conserva al reactivarlo, la de anoche al
      // cambiar de día, la de antes de bloquear el teléfono): no se usa.
      if (
        ahoraMs - momento > MAX_EDAD_LECTURA_MS ||
        momento < state.cargadoEn - MARGEN_CARGA_MS
      ) {
        return state
      }
      const precisa = lecturaPrecisa(action.posicion.accuracy)
      // Se vuelve a vigilar desde ahora en la primera lectura precisa tras
      // cargar, tras lecturas imprecisas o tras volver de una ausencia larga.
      const reiniciar =
        precisa && (!state.ultimaPrecisa || state.precisaEn < regreso)
      const desdeMin = reiniciar
        ? minutosDelDia(new Date(ahoraMs))
        : state.desdeMin
      const vigilancia = {
        desdeMin,
        precisaEn: precisa ? ahoraMs : state.precisaEn,
        ultimaPrecisa: precisa,
      }
      const { llegadas, cambios } = evaluarLlegadas(
        action.actividades,
        action.posicion,
        momento,
        state.llegadas
      )
      if (cambios.length === 0) return { ...state, ...vigilancia }
      let seq = state.seq
      const nuevos = cambios.map((c) => {
        seq += 1
        return { ...c, seq }
      })
      return {
        ...state,
        ...vigilancia,
        llegadas,
        seq,
        eventos: [...nuevos.reverse(), ...state.eventos].slice(0, MAX_EVENTOS),
      }
    }

    case 'DESCARTAR':
      return state.descartadas.includes(action.clave)
        ? state
        : { ...state, descartadas: agregar(state.descartadas, action.clave) }

    case 'OMITIR':
      return state.omitidas.includes(action.id)
        ? state
        : { ...state, omitidas: agregar(state.omitidas, action.id) }

    case 'MENSAJE':
      return {
        ...state,
        mensajes: { ...state.mensajes, [action.clave]: action.mensaje },
      }

    default:
      return state
  }
}

export function useAlertasViaje({
  tripId,
  actividades,
  ubicacion,
  ahora,
  esCrucero,
}: UseAlertasViajeParams): UseAlertasViajeReturn {
  const [estado, dispatch] = useReducer(reducer, INICIAL)

  const fecha = ahora ? fechaISO(ahora) : null
  const ahoraMin = ahora ? minutosDelDia(ahora) : null
  const lista = actividades && actividades.length > 0 ? actividades : null
  const alcance = ubicacion && fecha && lista ? `${tripId}:${fecha}` : null
  const activo = alcance !== null && estado.alcance === alcance
  const {
    llegadas,
    omitidas,
    descartadas,
    desdeMin,
    precisaEn,
    ultimaPrecisa,
    mensajes,
  } = estado
  const regreso = useSyncExternalStore(
    suscribirRegreso,
    leerRegreso,
    regresoEnServidor
  )
  // Demoras solo con una lectura precisa y, tras una ausencia larga, nueva.
  const vigilando =
    activo && desdeMin !== null && ultimaPrecisa && precisaEn >= regreso

  // ── Carga del día guardado en este navegador ────────────────────────────
  useEffect(() => {
    if (!alcance || !fecha) return
    dispatch({
      type: 'CARGAR',
      alcance,
      guardado: leerDia(tripId, fecha),
      ahoraMs: Date.now(),
    })
  }, [alcance, tripId, fecha])

  // ── Se recuerda en cada cambio (solo el día cargado) ────────────────────
  useEffect(() => {
    if (!activo || !fecha) return
    guardarDia(tripId, {
      fecha,
      llegadas: { ...llegadas },
      omitidas: [...omitidas],
      descartadas: [...descartadas],
    })
  }, [activo, tripId, fecha, llegadas, omitidas, descartadas])

  // ── Cada posición del GPS: llegadas y salidas ───────────────────────────
  useEffect(() => {
    if (!activo || !alcance || !ubicacion || !lista) return
    const momento =
      Number.isFinite(ubicacion.timestamp) && ubicacion.timestamp > 0
        ? ubicacion.timestamp
        : Date.now()
    dispatch({
      type: 'POSICION',
      alcance,
      actividades: lista,
      posicion: ubicacion,
      momento,
      ahoraMs: Date.now(),
      regreso: leerRegreso(),
    })
  }, [activo, alcance, ubicacion, lista])

  // ── Nivel de demora (derivado de la hora y de las llegadas) ─────────────
  const omitidasSet = useMemo(() => new Set(omitidas), [omitidas])
  const evaluacion = useMemo(
    () =>
      vigilando && lista && ahoraMin !== null && desdeMin !== null
        ? evaluarRetraso({
            actividades: lista,
            ahoraMin,
            llegadas,
            omitidas: omitidasSet,
            vigiladoDesdeMin: desdeMin,
          })
        : SIN_RETRASO,
    [vigilando, lista, ahoraMin, llegadas, omitidasSet, desdeMin]
  )

  const alerta = useMemo<AlertaRetraso | null>(() => {
    const { nivel, actividad, retrasoMinutos } = evaluacion
    if (nivel === 0 || !actividad || !lista) return null
    const clave = claveRetraso(actividad.id, nivel)
    if (descartadas.includes(clave)) return null
    return {
      clave,
      nivel,
      retrasoMinutos,
      actividad,
      restantes: restantesTrasActividad(lista, actividad, llegadas),
    }
  }, [evaluacion, descartadas, lista, llegadas])

  // ── Nivel 3: mensaje del servidor, una vez por actividad ────────────────
  const pedidos = useRef(new Set<string>())
  const controles = useRef(new Set<AbortController>())

  useEffect(() => {
    if (!alerta || alerta.nivel !== 3) return
    const { clave, actividad, restantes, retrasoMinutos } = alerta
    if (pedidos.current.has(clave)) return
    pedidos.current.add(clave)
    const control = new AbortController()
    const enCurso = controles.current
    enCurso.add(control)
    void pedirMensajeAlerta(actividad, restantes, retrasoMinutos, {
      nivel: 3,
      esCrucero,
      signal: control.signal,
    }).then((mensaje) => {
      enCurso.delete(control)
      if (!control.signal.aborted) {
        dispatch({ type: 'MENSAJE', clave, mensaje })
      }
    })
  }, [alerta, esCrucero])

  // Al desmontar se cancela lo pendiente (y se podrá volver a pedir).
  useEffect(() => {
    const enCurso = controles.current
    const yaPedidos = pedidos.current
    return () => {
      for (const c of enCurso) c.abort()
      enCurso.clear()
      yaPedidos.clear()
    }
  }, [])

  // ── Notificaciones con la pestaña oculta ────────────────────────────────
  const nivelAvisado = useRef(new Map<string, number>())
  const ultimaNotificacion = useRef(0)

  useEffect(() => {
    if (!alerta) return
    const { actividad, nivel, retrasoMinutos } = alerta
    // Cada nivel se avisa una sola vez, se vea en la página o no.
    if (nivel <= (nivelAvisado.current.get(actividad.id) ?? 0)) return
    nivelAvisado.current.set(actividad.id, nivel)
    if (nivel < NIVEL_MIN_NOTIFICACION || !puedeNotificar()) return
    const ahoraMs = Date.now()
    if (ahoraMs - ultimaNotificacion.current < ENTRE_NOTIFICACIONES_MS) return
    ultimaNotificacion.current = ahoraMs
    void notificarSiOculta('Vas con retraso', {
      cuerpo: `Llevas ${retrasoMinutos} min de retraso para ${actividad.nombre}. Vuelve a Wayio para decidir qué hacer.`,
      // Una etiqueta por nivel: la urgente suena aunque la del 3 siga ahí.
      etiqueta: `wayio-retraso-${actividad.id}-n${nivel}`,
    })
  }, [alerta])

  const ultimoNotificado = useRef(0)
  const { eventos } = estado
  useEffect(() => {
    const nuevos = eventos.filter((e) => e.seq > ultimoNotificado.current)
    if (nuevos.length === 0) return
    ultimoNotificado.current = Math.max(...nuevos.map((e) => e.seq))
    if (!puedeNotificar()) return
    for (const e of nuevos) {
      if (e.tipo !== 'llegada') continue
      void notificarSiOculta(`Llegaste a ${e.nombre}`, {
        cuerpo: 'La marcamos como en curso en tu día.',
        etiqueta: `wayio-llegada-${e.actividadId}`,
      })
    }
  }, [eventos])

  // ── API ─────────────────────────────────────────────────────────────────
  const descartar = useCallback((clave: string) => {
    dispatch({ type: 'DESCARTAR', clave })
  }, [])

  const omitir = useCallback((actividadId: string) => {
    dispatch({ type: 'OMITIR', id: actividadId })
  }, [])

  const mensaje = alerta?.nivel === 3 ? (mensajes[alerta.clave] ?? null) : null
  const recomendada = useMemo(
    () =>
      alerta && mensaje
        ? actividadRecomendada(mensaje, alerta.restantes)
        : null,
    [alerta, mensaje]
  )

  return {
    activo,
    alerta: activo ? alerta : null,
    mensaje: activo ? mensaje : null,
    recomendada: activo ? recomendada : null,
    eventos: activo ? eventos : SIN_EVENTOS,
    descartar,
    omitir,
  }
}
