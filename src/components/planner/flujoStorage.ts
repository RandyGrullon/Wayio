import type { GenerateResult } from '@/lib/ai/generateTrips'
import type { InterpretResult } from '@/lib/validations/interpret'
import { TripFormSchema, type TripForm } from '@/lib/validations/tripForm'
import type { Trip } from '@/types/trip'
import {
  borradorVacio,
  sanearBorrador,
  type Paquete,
  type TripFormDraft,
} from './borrador'

/**
 * Estado del flujo /planificar en sessionStorage (docs/DISENO.md §6 General):
 * Atrás y recargar no pierden el formulario, las versiones ni el itinerario
 * editado. Todo acceso va en try/catch (modo privado, cuota llena…): si falla,
 * el flujo sigue funcionando en memoria.
 */

export const CLAVE_FLUJO = 'wayio-flujo-v1'
/** Itinerario pendiente de guardar tras iniciar sesión (DA-14). */
export const CLAVE_PENDIENTE = 'wayio-pendiente-v1'

export interface GuardadoFlujo {
  /** id de la fila en /api/trips. */
  id: string
  /** Firma del itinerario guardado: si cambia, se actualiza con PUT. */
  firma: string
}

export interface EstadoFlujo {
  v: 1
  borrador: TripFormDraft
  /** Último formulario enviado (el que originó las versiones). */
  formData: TripForm | null
  resultado: GenerateResult | null
  paquete: Paquete
  /** Itinerario elegido (con las ediciones del usuario). */
  itinerario: Trip | null
  guardado: GuardadoFlujo | null
  interpretacion: InterpretResult | null
}

export function estadoInicial(): EstadoFlujo {
  return {
    v: 1,
    borrador: borradorVacio(),
    formData: null,
    resultado: null,
    paquete: 'confort',
    itinerario: null,
    guardado: null,
    interpretacion: null,
  }
}

// ─── Acceso seguro ─────────────────────────────────────────────────────────

function leer(clave: string): unknown {
  try {
    const raw = window.sessionStorage.getItem(clave)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

function escribir(clave: string, valor: unknown): boolean {
  try {
    window.sessionStorage.setItem(clave, JSON.stringify(valor))
    return true
  } catch {
    return false
  }
}

function borrar(clave: string): void {
  try {
    window.sessionStorage.removeItem(clave)
  } catch {
    // Sin almacenamiento: no hay nada que borrar.
  }
}

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Comprobación mínima de forma de un Trip (datos propios del origen). */
export function esTrip(v: unknown): v is Trip {
  return (
    esObjeto(v) &&
    typeof v['id'] === 'string' &&
    typeof v['destino'] === 'string' &&
    Array.isArray(v['dias']) &&
    typeof v['presupuestoTotal'] === 'number'
  )
}

function esResultado(v: unknown): v is GenerateResult {
  return (
    esObjeto(v) &&
    esTrip(v['basico']) &&
    esTrip(v['confort']) &&
    esTrip(v['premium'])
  )
}

function esFormulario(v: unknown): v is TripForm {
  return (
    esObjeto(v) &&
    typeof v['destino'] === 'string' &&
    typeof v['fechaInicio'] === 'string' &&
    typeof v['fechaFin'] === 'string' &&
    typeof v['personas'] === 'number' &&
    typeof v['presupuesto'] === 'number'
  )
}

function esInterpretacion(v: unknown): v is InterpretResult {
  return (
    esObjeto(v) &&
    esObjeto(v['campos']) &&
    Array.isArray(v['faltantes']) &&
    typeof v['resumen'] === 'string' &&
    Array.isArray(v['supuestos'])
  )
}

// ─── Estado del flujo ──────────────────────────────────────────────────────

export function leerFlujo(): EstadoFlujo {
  const base = estadoInicial()
  const v = leer(CLAVE_FLUJO)
  if (!esObjeto(v) || v['v'] !== 1) return base
  const paquete = (['basico', 'confort', 'premium'] as const).find(
    (p) => p === v['paquete']
  )
  const guardado = v['guardado']
  return {
    v: 1,
    borrador: sanearBorrador(v['borrador']),
    formData: esFormulario(v['formData']) ? v['formData'] : null,
    resultado: esResultado(v['resultado']) ? v['resultado'] : null,
    paquete: paquete ?? base.paquete,
    itinerario: esTrip(v['itinerario']) ? v['itinerario'] : null,
    guardado:
      esObjeto(guardado) &&
      typeof guardado['id'] === 'string' &&
      typeof guardado['firma'] === 'string'
        ? { id: guardado['id'], firma: guardado['firma'] }
        : null,
    interpretacion: esInterpretacion(v['interpretacion'])
      ? v['interpretacion']
      : null,
  }
}

export function guardarFlujo(estado: EstadoFlujo): void {
  if (escribir(CLAVE_FLUJO, estado)) return
  // Cuota llena: se conserva lo esencial (formulario e itinerario elegido).
  escribir(CLAVE_FLUJO, { ...estado, resultado: null, interpretacion: null })
}

export function borrarFlujo(): void {
  borrar(CLAVE_FLUJO)
}

// ─── Pendiente de guardar (sin sesión) ─────────────────────────────────────

export interface Pendiente {
  trip: Trip
  accion: 'guardar' | 'compartir'
  creado: number
}

/** Un pendiente caduca a las 2 h (si el usuario no volvió a tiempo). */
const CADUCIDAD_PENDIENTE = 2 * 60 * 60 * 1000

export function guardarPendiente(
  trip: Trip,
  accion: Pendiente['accion']
): boolean {
  return escribir(CLAVE_PENDIENTE, { trip, accion, creado: Date.now() })
}

export function leerPendiente(): Pendiente | null {
  const v = leer(CLAVE_PENDIENTE)
  if (!esObjeto(v) || !esTrip(v['trip'])) return null
  const creado = Number(v['creado'])
  if (!Number.isFinite(creado) || Date.now() - creado > CADUCIDAD_PENDIENTE) {
    borrar(CLAVE_PENDIENTE)
    return null
  }
  return {
    trip: v['trip'],
    accion: v['accion'] === 'compartir' ? 'compartir' : 'guardar',
    creado,
  }
}

export function borrarPendiente(): void {
  borrar(CLAVE_PENDIENTE)
}

// ─── Trazar pendiente (sin sesión) ─────────────────────────────────────────

/**
 * Trazar exige cuenta: al pulsar «Trazar» sin sesión el formulario queda aquí
 * y se traza solo al volver de ESE login (/planificar?paso=datos&reanudar=1,
 * ver PlannerFlow). Va en localStorage (no en sessionStorage) para sobrevivir
 * a la confirmación del registro o al enlace mágico abiertos desde el correo
 * en otra pestaña; caduca a las 2 h y se borra al usarse o al empezar
 * cualquier otro trazado. Nunca viaja en la URL.
 */
export const CLAVE_GENERAR_PENDIENTE = 'wayio-generar-pendiente-v1'

export interface GenerarPendiente {
  form: TripForm
  noCache: boolean
  creado: number
}

export function guardarGenerarPendiente(
  form: TripForm,
  noCache: boolean
): boolean {
  try {
    window.localStorage.setItem(
      CLAVE_GENERAR_PENDIENTE,
      JSON.stringify({ form, noCache, creado: Date.now() })
    )
    return true
  } catch {
    return false
  }
}

export function borrarGenerarPendiente(): void {
  try {
    window.localStorage.removeItem(CLAVE_GENERAR_PENDIENTE)
  } catch {
    // Sin almacenamiento: no hay nada que borrar.
  }
}

export function leerGenerarPendiente(): GenerarPendiente | null {
  let v: unknown = null
  try {
    const raw = window.localStorage.getItem(CLAVE_GENERAR_PENDIENTE)
    v = raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
  if (!esObjeto(v)) return null
  const creado = Number(v['creado'])
  const form = TripFormSchema.safeParse(v['form'])
  if (
    !form.success ||
    !Number.isFinite(creado) ||
    Date.now() - creado > CADUCIDAD_PENDIENTE
  ) {
    borrarGenerarPendiente()
    return null
  }
  return { form: form.data, noCache: v['noCache'] === true, creado }
}

/** ¿Esta pestaña tiene un flujo guardado? (otra pestaña empieza vacía). */
export function hayFlujoGuardado(): boolean {
  return leer(CLAVE_FLUJO) !== null
}

// ─── Firma de un itinerario ────────────────────────────────────────────────

/** Hash djb2 del JSON del itinerario (detecta ediciones tras guardar). */
export function firmaDe(trip: Trip): string {
  const s = JSON.stringify(trip)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `${s.length.toString(36)}-${(h >>> 0).toString(36)}`
}
