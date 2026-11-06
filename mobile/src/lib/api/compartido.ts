/**
 * Vista pública de un viaje (wayio://viaje-compartido/<id>) y «Copiar a mis
 * viajes», como /viaje-compartido/[id] de la web.
 *
 * - Lectura: GET /api/shared/[id] (sin sesión; solo responde si el dueño
 *   marcó el viaje como público y nunca trae grupo_link ni user_id). Sin
 *   EXPO_PUBLIC_API_URL se llama a la misma RPC que usa ese endpoint
 *   (get_shared_trip, abierta a anon y authenticated).
 * - Copia: un viaje nuevo del usuario con las actividades en «pendiente»
 *   (CopiarAMisViajes.tsx de la web) por POST /api/trips, que lo sanea; sin
 *   API, con lib/trips/repository (Supabase directo con RLS).
 */
import { config } from '../../config'
import { getSupabase } from '../supabase/client'
import { createTrip } from '../trips/repository'
import type {
  PlanningActivity,
  PlanningDay,
  PlanningTrip,
} from '../../types/planning'
import { BackendError, getJSON, postJSON } from './http'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ViajeCompartido =
  | {
      estado: 'ok'
      trip: PlanningTrip
      destino: string
      fechaInicio: string
      fechaFin: string
    }
  | { estado: 'no_encontrado' }
  | { estado: 'no_disponible'; mensaje: string }

const MENSAJE_NO_DISPONIBLE =
  'Estamos teniendo problemas para mostrar este viaje. Vuelve a intentarlo en unos minutos.'

interface RespuestaShared {
  trip?: {
    data?: unknown
    destino?: unknown
    fechaInicio?: unknown
    fechaFin?: unknown
  }
}

interface Crudo {
  data: unknown
  destino: unknown
  fechaInicio: unknown
  fechaFin: unknown
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function textos(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string')
    : []
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Número finito, o `respaldo` (jsonb puede traer "12", null o NaN). */
function numero(v: unknown, respaldo = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : respaldo
}

/** Solo los opcionales con el tipo correcto; el resto se omite. */
function opcionales(a: Record<string, unknown>): Partial<PlanningActivity> {
  const out: Partial<PlanningActivity> = {}
  if (typeof a['coordsVerificadas'] === 'boolean') {
    out.coordsVerificadas = a['coordsVerificadas']
  }
  if (typeof a['linkAfiliado'] === 'string') {
    out.linkAfiliado = a['linkAfiliado']
  }
  const reagendada = a['reagendadaDesdeDia']
  if (typeof reagendada === 'number' && Number.isFinite(reagendada)) {
    out.reagendadaDesdeDia = reagendada
  }
  const embarque = a['tiempoEmbarqueMinutos']
  if (typeof embarque === 'number' && Number.isFinite(embarque)) {
    out.tiempoEmbarqueMinutos = embarque
  }
  if (typeof a['puertoCrucero'] === 'boolean') {
    out.puertoCrucero = a['puertoCrucero']
  }
  return out
}

const TIPOS: readonly PlanningActivity['tipo'][] = [
  'museo',
  'restaurante',
  'templo',
  'parque',
  'barrio',
  'playa',
  'actividad',
  'traslado',
]

const ESTADOS: readonly PlanningActivity['estado'][] = [
  'pendiente',
  'en_curso',
  'completada',
  'perdida',
  'recuperada',
]

/**
 * Cada campo que pinta DayCard con su tipo: textos como texto (descripcion
 * se mide con .length), cifras como número y coordenadas 0,0 («sin ubicar»)
 * si faltan, para que no salga «Cómo llegar» a undefined,undefined.
 */
function normalizarActividad(
  a: Record<string, unknown>,
  dia: number,
  indice: number
): PlanningActivity {
  const tipo = TIPOS.find((t) => t === a['tipo']) ?? 'actividad'
  const estado = ESTADOS.find((e) => e === a['estado']) ?? 'pendiente'
  return {
    ...opcionales(a),
    id:
      typeof a['id'] === 'string' && a['id']
        ? a['id']
        : `actividad-${dia}-${indice + 1}`,
    nombre: texto(a['nombre']),
    descripcion: texto(a['descripcion']),
    horaInicio: texto(a['horaInicio']),
    horaFin: texto(a['horaFin']),
    duracionMinutos: numero(a['duracionMinutos']),
    tipo,
    direccion: texto(a['direccion']),
    lat: numero(a['lat']),
    lng: numero(a['lng']),
    radioGeofencingMetros: numero(a['radioGeofencingMetros']),
    precioEstimado: numero(a['precioEstimado']),
    reservaRequerida: a['reservaRequerida'] === true,
    reservaPagada: a['reservaPagada'] === true,
    mejorHoraVisita: texto(a['mejorHoraVisita']),
    consejos: textos(a['consejos']),
    tiempoHastaSiguiente: numero(a['tiempoHastaSiguiente']),
    estado,
    esPerdida: a['esPerdida'] === true,
  }
}

/**
 * `trips.data` es jsonb de otra persona: se garantiza la forma que pintan
 * las pantallas (listas que existen, días con actividades completas) para
 * que un viaje antiguo o incompleto no rompa la vista. null si no tiene días.
 */
function normalizar(data: unknown): PlanningTrip | null {
  if (!esObjeto(data) || !Array.isArray(data['dias'])) return null
  const dias = (data['dias'] as unknown[])
    .filter(esObjeto)
    .map((d, i): PlanningDay => {
      const num = numero(d['numero'], i + 1)
      const actividades = Array.isArray(d['actividades'])
        ? (d['actividades'] as unknown[]).filter(esObjeto)
        : []
      return {
        numero: num,
        titulo: texto(d['titulo']),
        descripcion: texto(d['descripcion']),
        ciudad: texto(d['ciudad']),
        presupuestoDia: numero(d['presupuestoDia']),
        colorMapa: texto(d['colorMapa']),
        actividades: actividades.map((a, j) => normalizarActividad(a, num, j)),
      }
    })
  const personas = numero(data['personas'], 1)
  return {
    ...(data as unknown as PlanningTrip),
    destino: texto(data['destino']),
    origen: texto(data['origen']),
    fechaInicio: texto(data['fechaInicio']),
    fechaFin: texto(data['fechaFin']),
    personas: personas > 0 ? personas : 1,
    presupuestoTotal: numero(data['presupuestoTotal']),
    presupuestoPorPersona: numero(data['presupuestoPorPersona']),
    resumenViaje: texto(data['resumenViaje']),
    consejos: textos(data['consejos']),
    advertencias: textos(data['advertencias']),
    listaActividades: textos(data['listaActividades']),
    actividadesPendientes: [],
    dias,
  }
}

/** Misma forma que obtenerCompartido (src/app/viaje-compartido/[id]/_lib). */
function aVista(crudo: Crudo): ViajeCompartido {
  const trip = normalizar(crudo.data)
  if (!trip) return { estado: 'no_encontrado' }
  const destino =
    (typeof crudo.destino === 'string' ? crudo.destino : trip.destino).trim() ||
    'Tu destino'
  return {
    estado: 'ok',
    trip,
    destino,
    fechaInicio:
      typeof crudo.fechaInicio === 'string'
        ? crudo.fechaInicio
        : trip.fechaInicio,
    fechaFin:
      typeof crudo.fechaFin === 'string' ? crudo.fechaFin : trip.fechaFin,
  }
}

async function leerDelBackend(id: string): Promise<ViajeCompartido> {
  try {
    const r = await getJSON<RespuestaShared>(
      `/api/shared/${encodeURIComponent(id)}`,
      { timeoutMs: 20_000 }
    )
    if (!r.trip) return { estado: 'no_encontrado' }
    return aVista({
      data: r.trip.data,
      destino: r.trip.destino,
      fechaInicio: r.trip.fechaInicio,
      fechaFin: r.trip.fechaFin,
    })
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) {
      return { estado: 'no_encontrado' }
    }
    return {
      estado: 'no_disponible',
      mensaje:
        e instanceof BackendError &&
        (e.code === 'network' ||
          e.code === 'timeout' ||
          e.code === 'rate_limit')
          ? e.message
          : MENSAJE_NO_DISPONIBLE,
    }
  }
}

async function leerDeSupabase(id: string): Promise<ViajeCompartido> {
  try {
    const { data, error } = await getSupabase().rpc('get_shared_trip', {
      p_id: id,
    })
    if (error)
      return { estado: 'no_disponible', mensaje: MENSAJE_NO_DISPONIBLE }
    if (!esObjeto(data)) return { estado: 'no_encontrado' }
    return aVista({
      data: data['data'],
      destino: data['destino'],
      fechaInicio: data['fecha_inicio'],
      fechaFin: data['fecha_fin'],
    })
  } catch {
    return { estado: 'no_disponible', mensaje: MENSAJE_NO_DISPONIBLE }
  }
}

/** Lee la versión pública del viaje `id`. Nunca lanza. */
export function leerViajeCompartido(id: string): Promise<ViajeCompartido> {
  if (!UUID_RE.test(id)) return Promise.resolve({ estado: 'no_encontrado' })
  return config.apiUrl ? leerDelBackend(id) : leerDeSupabase(id)
}

function nuevoId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `viaje-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  )
}

const MENSAJE_COPIA_FALLIDA = 'No pudimos copiar el viaje. Inténtalo de nuevo.'

/**
 * Copia el viaje a los del usuario (CopiarAMisViajes de la web): id nuevo,
 * sin pendientes y con cada actividad sin empezar, sin perder ni reservas
 * pagadas.
 *
 * Con EXPO_PUBLIC_API_URL va por POST /api/trips { trip } → 201 { trip: fila }
 * como la web: el servidor sanea el viaje ajeno (parsearTrip: tipos,
 * coordenadas, topes de días y actividades, enlaces https, tamaño máximo)
 * antes de guardarlo. Sin API, respaldo con createTrip (Supabase con RLS).
 *
 * Devuelve el id de la fila nueva. Lanza BackendError (texto del servidor,
 * p. ej. 400 «Este viaje tiene datos que no pudimos guardar…») o Error con
 * texto amable.
 */
export async function copiarAMisViajes(trip: PlanningTrip): Promise<string> {
  const copia = prepararCopia(trip)
  if (config.apiUrl) {
    const r = await postJSON<{ trip?: { id?: unknown } }>(
      '/api/trips',
      { trip: copia },
      { requiereSesion: true, timeoutMs: 30_000 }
    )
    const nuevo = r.trip?.id
    if (typeof nuevo !== 'string' || !UUID_RE.test(nuevo)) {
      throw new Error(MENSAJE_COPIA_FALLIDA)
    }
    return nuevo
  }
  try {
    return (await createTrip(copia)).id
  } catch {
    throw new Error(MENSAJE_COPIA_FALLIDA)
  }
}

function prepararCopia(trip: PlanningTrip): PlanningTrip {
  return {
    ...trip,
    id: nuevoId(),
    actividadesPendientes: [],
    dias: trip.dias.map((d) => ({
      ...d,
      actividades: d.actividades.map(
        (a): PlanningActivity => ({
          ...a,
          estado: 'pendiente',
          esPerdida: false,
          reservaPagada: false,
        })
      ),
    })),
  }
}
