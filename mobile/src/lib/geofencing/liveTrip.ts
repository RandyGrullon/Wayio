/**
 * Única fuente de verdad del estado de las actividades en el modo en vivo.
 *
 * El geofencing (primer plano y tarea en segundo plano), el motor de alertas,
 * la lista y el mapa leen y escriben el MISMO `Trip`. Estas funciones son
 * puras: el hook `useGeofencing` y la tarea `backgroundLocation` las usan y
 * guardan el resultado con `saveTrip`.
 */
import type {
  Activity,
  ActivityEvaluation,
  ActivityStatus,
} from '../../types/activity'
import type { Trip } from '../../types/trip'
import { geofenceDetector } from './detector'
import {
  faseDelViaje,
  finMin,
  horaDeMinutos,
  inicioMin,
  minutosDeHora,
  ordenarPorHora,
} from './fechas'

/** Cuánto ha avanzado una actividad. Nunca se retrocede al fusionar. */
const AVANCE: Record<ActivityStatus, number> = {
  pendiente: 0,
  en_curso: 1,
  completada: 2,
  perdida: 2,
}

const aFecha = (v: unknown): Date | undefined => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? undefined : d
  }
  return undefined
}

/** ISO de una marca de tiempo que puede venir como Date o como texto (JSON). */
export function isoDe(v: Date | string | undefined): string | undefined {
  return aFecha(v)?.toISOString()
}

function sinMarcas(a: Activity): Activity {
  const copia: Activity = { ...a }
  delete copia.horaEntrada
  delete copia.horaSalida
  return copia
}

function conMarca(
  a: Activity,
  campo: 'horaEntrada' | 'horaSalida',
  valor: unknown
): Activity {
  const fecha = aFecha(valor)
  const copia: Activity = { ...a }
  if (campo === 'horaEntrada') {
    if (fecha) copia.horaEntrada = fecha
    else delete copia.horaEntrada
  } else if (fecha) {
    copia.horaSalida = fecha
  } else {
    delete copia.horaSalida
  }
  return copia
}

/** Al leer de AsyncStorage las fechas llegan como texto: se convierten a Date. */
export function revivirFechas(trip: Trip): Trip {
  return {
    ...trip,
    dias: trip.dias.map((d) => ({
      ...d,
      actividades: d.actividades.map((a) =>
        conMarca(
          conMarca(a, 'horaEntrada', a.horaEntrada),
          'horaSalida',
          a.horaSalida
        )
      ),
    })),
  }
}

export function actividadesPlanas(trip: Trip): Activity[] {
  return trip.dias.flatMap((d) => d.actividades)
}

/**
 * Toma la estructura de `base` (la del viaje recién abierto) y le aplica el
 * avance guardado en el teléfono (`guardado`), actividad por actividad.
 */
export function fusionarEstados(base: Trip, guardado: Trip | null): Trip {
  if (!guardado) return base
  const previo = new Map(actividadesPlanas(guardado).map((a) => [a.id, a]))
  return {
    ...base,
    dias: base.dias.map((d) => ({
      ...d,
      actividades: d.actividades.map((a) => {
        const g = previo.get(a.id)
        if (!g || AVANCE[g.estado] <= AVANCE[a.estado]) return a
        return conMarca(
          conMarca({ ...a, estado: g.estado }, 'horaEntrada', g.horaEntrada),
          'horaSalida',
          g.horaSalida
        )
      }),
    })),
  }
}

/** Qué día se vigila: el de hoy, todos si el viaje no tiene fechas, o ninguno. */
export function diaVigilado(
  trip: Trip,
  ahora: Date,
  diaForzado?: number | null
): number | 'todos' | null {
  if (diaForzado !== undefined && diaForzado !== null) return diaForzado
  const fase = faseDelViaje(trip.dias, ahora)
  if (fase.tipo === 'durante') return fase.indiceHoy
  if (fase.tipo === 'sin_fechas') return 'todos'
  return null
}

export interface ResultadoEvaluacion {
  trip: Trip
  cambios: ActivityEvaluation[]
}

/**
 * Evalúa una posición contra las actividades del día vigilado. Solo cambian
 * las de ese día: pasar por delante del museo del día 3 no lo marca.
 */
export function evaluarPosicion(
  trip: Trip,
  lat: number,
  lng: number,
  dia: number | 'todos' | null
): ResultadoEvaluacion {
  if (dia === null) return { trip, cambios: [] }
  const cambios: ActivityEvaluation[] = []

  const dias = trip.dias.map((d) => {
    if (dia !== 'todos' && d.index !== dia) return d
    const evaluadas = geofenceDetector.evaluateActivities(
      lat,
      lng,
      d.actividades.filter((a) => a.lat !== 0 || a.lng !== 0)
    )
    const porId = new Map(evaluadas.map((e) => [e.id, e]))
    let tocado = false
    const actividades = d.actividades.map((a) => {
      const e = porId.get(a.id)
      if (!e?.estadoCambiado) return a
      tocado = true
      cambios.push(e)
      const { estadoCambiado: _cambio, ...actividad } = e
      return actividad
    })
    return tocado ? { ...d, actividades } : d
  })

  return cambios.length > 0
    ? { trip: { ...trip, dias }, cambios }
    : { trip, cambios }
}

const normalizar = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** Busca por id y, si no, por nombre (la IA antigua devolvía el nombre). */
export function buscarActividad(trip: Trip, ref: string): Activity | null {
  const todas = actividadesPlanas(trip)
  const porId = todas.find((a) => a.id === ref)
  if (porId) return porId
  const nombre = normalizar(ref)
  if (!nombre) return null
  return todas.find((a) => normalizar(a.nombre) === nombre) ?? null
}

function cambiarActividad(
  trip: Trip,
  id: string,
  cambio: (a: Activity) => Activity
): Trip {
  let tocado = false
  const dias = trip.dias.map((d) => {
    if (!d.actividades.some((a) => a.id === id)) return d
    tocado = true
    return {
      ...d,
      actividades: d.actividades.map((a) => (a.id === id ? cambio(a) : a)),
    }
  })
  return tocado ? { ...trip, dias } : trip
}

/** «Me la perdí» / «Saltar actividad»: queda perdida y deja de generar alertas. */
export function marcarPerdida(trip: Trip, id: string): Trip {
  return cambiarActividad(trip, id, (a) =>
    a.estado === 'perdida' ? a : { ...sinMarcas(a), estado: 'perdida' }
  )
}

export interface OpcionesReagendar {
  /** Posición sugerida dentro del día destino. */
  posicion?: number
  horaInicio?: string
  horaFin?: string
}

const MARGEN_MIN = 15
const INICIO_POR_DEFECTO = 9 * 60

/**
 * Mueve la actividad a otro día: la quita del original, calcula su nueva
 * hora (o usa la propuesta) y la vuelve a dejar pendiente.
 */
export function reagendar(
  trip: Trip,
  id: string,
  diaDestino: number,
  opciones: OpcionesReagendar = {}
): Trip {
  const original = actividadesPlanas(trip).find((a) => a.id === id)
  const destino = trip.dias.find((d) => d.index === diaDestino)
  if (!original || !destino) return trip

  const duracion = Math.max(15, original.duracionMinutos || 60)
  const otras = destino.actividades.filter((a) => a.id !== id)
  let inicio = minutosDeHora(opciones.horaInicio)
  if (inicio === null) {
    const pos = Math.min(
      Math.max(opciones.posicion ?? otras.length, 0),
      otras.length
    )
    const previa = otras[pos - 1]
    const siguiente = otras[pos]
    const finPrevia = previa ? finMin(previa) : null
    const inicioSiguiente = siguiente ? inicioMin(siguiente) : null
    inicio =
      finPrevia !== null
        ? finPrevia + MARGEN_MIN
        : inicioSiguiente !== null
          ? inicioSiguiente - duracion - MARGEN_MIN
          : INICIO_POR_DEFECTO
  }
  const fin = minutosDeHora(opciones.horaFin) ?? inicio + duracion

  const movida: Activity = {
    ...sinMarcas(original),
    estado: 'pendiente',
    diaIndex: diaDestino,
    horaInicio: horaDeMinutos(inicio),
    horaFin: horaDeMinutos(Math.max(fin, inicio + 1)),
  }

  return {
    ...trip,
    dias: trip.dias.map((d) => {
      const sinElla = d.actividades.filter((a) => a.id !== id)
      if (d.index !== diaDestino) {
        return sinElla.length === d.actividades.length
          ? d
          : { ...d, actividades: sinElla }
      }
      return { ...d, actividades: ordenarPorHora([...sinElla, movida]) }
    }),
  }
}
