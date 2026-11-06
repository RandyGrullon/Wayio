'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Trip } from '@/types/trip'
import { useToast } from '@/components/ui/Toast'
import {
  aplicarCoords,
  cambiosEntre,
  geocodificar,
  lugaresSinVerificar,
  resumenDeCambios,
} from '@/components/trip/tripUtils'

/** Niveles de deshacer (los mismos que el planificador). */
const MAX_DESHACER = 10
/** Lo que se espera a /api/geocode antes de guardar sin coordenadas nuevas. */
const GEOCODIFICAR_MS = 8_000

/** De dónde viene un cambio del viaje guardado. */
export type TipoCambio = 'ia' | 'manual' | 'deshacer'

interface Cambio {
  tipo: TipoCambio
  trip: Trip
  /** Resumen de la IA (solo 'ia'). */
  resumen?: string
  /** Actividades nuevas o editadas que se geocodifican antes de guardar. */
  geocodificar?: ReadonlySet<string>
}

/** Por qué un ajuste o un deshacer quedó sin guardar. */
export type MotivoPendiente = 'fallo' | 'pausa'

interface Pendiente {
  cambio: Cambio
  /** Viaje sobre el que se calculó (null si ya no se sabe: está desfasado). */
  base: Trip | null
  motivo: MotivoPendiente
}

export interface EstadoPendiente {
  tipo: 'ia' | 'deshacer'
  /** 'fallo': el servidor no lo guardó; 'pausa': llegó editando o guardando. */
  motivo: MotivoPendiente
  /** El viaje cambió desde que se calculó: aplicarlo pisaría esos cambios. */
  desfasado: boolean
}

export interface OpcionesEdicion {
  /** Moneda que se manda a la IA si el viaje no la trae. */
  moneda: NonNullable<Trip['moneda']>
  /**
   * Hay otra edición en curso (modo edición, «Me la perdí»…): los ajustes y
   * los deshacer que lleguen no se guardan, quedan pendientes.
   */
  enPausa: boolean
  /** useTrip está guardando (p. ej. «Me la perdí»): tampoco se solapa. */
  guardando: boolean
}

export interface UseEdicionViajeReturn {
  /** El viaje que se manda a /api/adjust (con moneda). */
  tripIA: Trip | null
  /** Geocodificando o guardando un cambio: no se puede empezar otro. */
  aplicando: boolean
  puedeDeshacer: boolean
  /** Ajuste o deshacer que no se guardó y se puede recuperar (o null). */
  pendiente: EstadoPendiente | null
  /** El último guardado de la edición manual falló. */
  falloManual: boolean
  resaltados: ReadonlySet<string>
  claveResaltado: number
  /** Ajuste de la IA recibido (onAdjusted de AdjustChat). */
  aplicarAjuste: (nuevo: Trip, resumen: string, enviado?: Trip) => void
  /** Guarda la edición manual. Devuelve el viaje guardado o null. */
  guardarEdicion: (
    nuevo: Trip,
    editadas: ReadonlySet<string>
  ) => Promise<Trip | null>
  /** Vuelve a la versión anterior al último cambio (y la guarda). */
  deshacer: () => void
  /**
   * Aplica el pendiente. Si está desfasado solo se aplica con `forzar`
   * (el usuario aceptó pisar lo que cambió después).
   */
  aplicarPendiente: (forzar?: boolean) => void
  descartarPendiente: () => void
  limpiarFalloManual: () => void
}

/**
 * Ajustes con IA, edición manual y deshacer (hasta 10 niveles) del viaje
 * guardado. Cada cambio se guarda en el servidor con `guardarViaje`
 * (PUT /api/trips/[id]); el viaje en pantalla solo cambia cuando el servidor
 * lo acepta, y VistaViaje refresca la copia sin conexión al cambiar el viaje.
 *
 * Nada se pierde en silencio: un ajuste de la IA (que gastó cupo) que no se
 * puede guardar ahora (falló, llegó en pausa o el viaje cambió mientras la IA
 * respondía) queda pendiente para «Reintentar» / «Aplicar igualmente».
 *
 * Si el viaje cambia por otra vía (reagendar, marcar perdida, recargar), el
 * historial deja de valer y se borra: deshacer no debe pisar lo guardado
 * después.
 */
export function useEdicionViaje(
  trip: Trip | null,
  guardarViaje: (data: Trip) => Promise<boolean>,
  { moneda, enPausa, guardando }: OpcionesEdicion
): UseEdicionViajeReturn {
  const { toast, success } = useToast()
  const [historial, setHistorial] = useState<Trip[]>([])
  const [aplicando, setAplicando] = useState(false)
  const [pendiente, setPendiente] = useState<Pendiente | null>(null)
  const [falloManual, setFalloManual] = useState(false)
  const [resaltados, setResaltados] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [claveResaltado, setClaveResaltado] = useState(0)

  const tripIA = useMemo<Trip | null>(
    () => (trip ? (trip.moneda ? trip : { ...trip, moneda }) : null),
    [trip, moneda]
  )

  // Última versión que guardó este hook y versión del viaje ya revisada.
  const [propia, setPropia] = useState<Trip | null>(null)
  const [revisada, setRevisada] = useState<Trip | null>(trip)
  if (revisada !== trip) {
    setRevisada(trip)
    if (trip !== propia) {
      if (historial.length > 0) setHistorial([])
      // Un deshacer pendiente se calculó con ese historial: ya no vale. Un
      // ajuste de la IA se conserva (queda desfasado).
      if (pendiente?.cambio.tipo === 'deshacer') setPendiente(null)
      if (resaltados.size > 0) setResaltados(new Set())
    }
  }

  const ultimo = useRef({
    trip,
    tripIA,
    historial,
    pendiente,
    enPausa,
    guardando,
  })
  const ocupado = useRef(false)
  useEffect(() => {
    ultimo.current = { trip, tripIA, historial, pendiente, enPausa, guardando }
  })

  /** Hay otra operación que no debe solaparse con un guardado de aquí. */
  const enPausaAhora = useCallback(
    () =>
      ultimo.current.enPausa || (ultimo.current.guardando && !ocupado.current),
    []
  )

  /**
   * Deja un cambio pendiente. Un ajuste de la IA ya pendiente no se sustituye
   * por un deshacer (el deshacer se puede repetir; el ajuste gastó cupo).
   */
  const encolar = useCallback(
    (p: Pendiente) => {
      const actual = ultimo.current.pendiente
      if (actual?.cambio.tipo === 'ia' && p.cambio.tipo !== 'ia') {
        toast({
          message: 'Primero aplica o descarta el ajuste con IA pendiente.',
        })
        return
      }
      ultimo.current = { ...ultimo.current, pendiente: p }
      setPendiente(p)
    },
    [toast]
  )

  const deshacerSiRef = useRef<(esperado: Trip) => void>(() => undefined)

  const confirmar = useCallback(
    async (cambio: Cambio, desdePendiente = false): Promise<Trip | null> => {
      const base = ultimo.current.trip
      if (!base) return null
      if (ocupado.current) {
        if (cambio.tipo !== 'manual') {
          encolar({ cambio, base, motivo: 'pausa' })
        }
        return null
      }
      ocupado.current = true
      setAplicando(true)
      if (desdePendiente) {
        ultimo.current = { ...ultimo.current, pendiente: null }
        setPendiente(null)
      }
      if (cambio.tipo === 'manual') setFalloManual(false)
      try {
        let data = cambio.trip
        const ids = cambio.geocodificar
        const lugares =
          ids && ids.size > 0 ? lugaresSinVerificar(data, ids) : []
        if (lugares.length > 0) {
          // Best-effort y con tope de tiempo: sin coordenadas también se guarda.
          const control = new AbortController()
          const tope = window.setTimeout(() => control.abort(), GEOCODIFICAR_MS)
          try {
            data = aplicarCoords(
              data,
              await geocodificar(lugares, control.signal)
            )
          } finally {
            window.clearTimeout(tope)
          }
        }

        setPropia(data)
        const ok = await guardarViaje(data)
        if (!ok) {
          if (cambio.tipo === 'manual') {
            setFalloManual(true)
          } else {
            // Ya geocodificado: reintentar no vuelve a pedirlo.
            const { geocodificar: _yaHecho, ...resto } = cambio
            void _yaHecho
            encolar({ cambio: { ...resto, trip: data }, base, motivo: 'fallo' })
          }
          return null
        }

        if (cambio.tipo === 'deshacer') {
          setHistorial((h) => h.slice(0, -1))
          setResaltados(new Set())
          toast({ message: 'Deshicimos el último cambio' })
          return data
        }
        setHistorial((h) => [...h, base].slice(-MAX_DESHACER))
        // Un deshacer pendiente apuntaba a la cima anterior: ya no vale.
        if (ultimo.current.pendiente?.cambio.tipo === 'deshacer') {
          ultimo.current = { ...ultimo.current, pendiente: null }
          setPendiente(null)
        }
        // El «Deshacer» del toast deshace ESTE cambio, solo si sigue siendo
        // el último.
        const accion = {
          label: 'Deshacer',
          onClick: () => deshacerSiRef.current(data),
        }
        if (cambio.tipo === 'ia') {
          const { ids: cambiadas, porDia } = cambiosEntre(base, data)
          setResaltados(cambiadas)
          setClaveResaltado((k) => k + 1)
          toast({
            message: resumenDeCambios(porDia),
            ...(cambio.resumen ? { description: cambio.resumen } : {}),
            action: accion,
          })
        } else {
          setResaltados(new Set())
          success('Cambios guardados', { action: accion })
        }
        return data
      } finally {
        ocupado.current = false
        setAplicando(false)
      }
    },
    [encolar, guardarViaje, success, toast]
  )

  /** Deshace el último cambio; con `esperado`, solo si ese sigue siendo el último. */
  const deshacerHasta = useCallback(
    (esperado?: Trip) => {
      const { trip: actual, historial: h } = ultimo.current
      const previo = h[h.length - 1]
      if (!previo || !actual) return
      if (esperado && esperado !== actual) {
        toast({
          message:
            'Ese cambio ya no es el último: no se puede deshacer desde aquí.',
        })
        return
      }
      const cambio: Cambio = { tipo: 'deshacer', trip: previo }
      if (ocupado.current || enPausaAhora()) {
        encolar({ cambio, base: actual, motivo: 'pausa' })
        return
      }
      void confirmar(cambio)
    },
    [confirmar, encolar, enPausaAhora, toast]
  )

  useEffect(() => {
    deshacerSiRef.current = (esperado: Trip) => deshacerHasta(esperado)
  }, [deshacerHasta])

  // Sin argumentos: AdjustChat lo usa como onClick y le pasaría el evento.
  const deshacer = useCallback(() => deshacerHasta(), [deshacerHasta])

  const aplicarAjuste = useCallback(
    (nuevo: Trip, resumen: string, enviado?: Trip) => {
      const { trip: actual, tripIA: actualIA } = ultimo.current
      // ¿Se pidió sobre el viaje que hay ahora? Si no, queda desfasado.
      const base = !enviado || enviado === actualIA ? actual : null
      const desde = enviado ?? actual
      const cambio: Cambio = {
        tipo: 'ia',
        trip: nuevo,
        resumen,
        ...(desde ? { geocodificar: cambiosEntre(desde, nuevo).ids } : {}),
      }
      if (!base || ocupado.current || enPausaAhora()) {
        encolar({ cambio, base, motivo: 'pausa' })
        return
      }
      void confirmar(cambio)
    },
    [confirmar, encolar, enPausaAhora]
  )

  const guardarEdicion = useCallback(
    (nuevo: Trip, editadas: ReadonlySet<string>) =>
      confirmar({ tipo: 'manual', trip: nuevo, geocodificar: editadas }),
    [confirmar]
  )

  const aplicarPendiente = useCallback(
    (forzar = false) => {
      const p = ultimo.current.pendiente
      if (!p) return
      if (ocupado.current || enPausaAhora()) {
        toast({ message: 'Espera a que termine el cambio en curso.' })
        return
      }
      // Se comprueba ahora, no con lo que se pintó: si cambió, se pide confirmar.
      if (p.base !== ultimo.current.trip && !forzar) return
      void confirmar(p.cambio, true)
    },
    [confirmar, enPausaAhora, toast]
  )

  const descartarPendiente = useCallback(() => {
    ultimo.current = { ...ultimo.current, pendiente: null }
    setPendiente(null)
  }, [])

  const limpiarFalloManual = useCallback(() => setFalloManual(false), [])

  return {
    tripIA,
    aplicando,
    puedeDeshacer: historial.length > 0,
    pendiente: pendiente
      ? {
          tipo: pendiente.cambio.tipo === 'ia' ? 'ia' : 'deshacer',
          motivo: pendiente.motivo,
          desfasado: pendiente.base !== trip,
        }
      : null,
    falloManual,
    resaltados,
    claveResaltado,
    aplicarAjuste,
    guardarEdicion,
    deshacer,
    aplicarPendiente,
    descartarPendiente,
    limpiarFalloManual,
  }
}
