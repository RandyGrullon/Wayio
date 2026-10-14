/**
 * Formulario del viaje en la app: mismo contrato que `TripFormSchema` de la
 * web (src/lib/validations/tripForm.ts) más la descripción libre y los
 * lugares deseados. La validación replica la del servidor para mostrar los
 * errores por campo antes de enviar.
 */
import type { Moneda, Paquete, TripFormValues } from '../../types/planning'
import { contarDias, hoyLocal, parseFecha } from '../../components/ui/formato'

export type TipoViaje = TripFormValues['tipo']

/** TripForm completo (incluye `descripcion`, `zona`, `lugaresDeseados`…). */
export type FormularioViaje = TripFormValues

export const MAX_DIAS_VIAJE = 30
/** Límite visual del contador (el servidor acepta hasta 2000). */
export const MAX_DESCRIPCION = 600

export const MONEDAS: readonly Moneda[] = ['USD', 'EUR', 'DOP']
export const PAQUETES: readonly Paquete[] = ['basico', 'confort', 'premium']

export type CampoFormulario =
  | 'descripcion'
  | 'destino'
  | 'origen'
  | 'fechaInicio'
  | 'fechaFin'
  | 'personas'
  | 'presupuesto'
  | 'tipo'
  | 'zona'

export type ErroresFormulario = Partial<Record<CampoFormulario, string>>

/** Validación previa al envío (mensajes en español, por campo). */
export function validarFormulario(f: FormularioViaje): ErroresFormulario {
  const e: ErroresFormulario = {}
  if (!f.destinoSorpresa && f.destino.trim().length < 2) {
    e.destino = 'Escribe a dónde quieres ir o elige «Sorpréndeme».'
  }
  if (f.origen.trim().length < 2) {
    e.origen = 'Indica desde qué ciudad sales.'
  }
  const ini = parseFecha(f.fechaInicio)
  const fin = parseFecha(f.fechaFin)
  if (!ini) e.fechaInicio = 'Elige la fecha de salida.'
  else if (f.fechaInicio < hoyLocal()) {
    e.fechaInicio = 'La salida no puede ser en el pasado.'
  }
  if (!fin) e.fechaFin = 'Elige la fecha de regreso.'
  else if (ini) {
    const dias = contarDias(ini, fin)
    if (dias < 1) {
      e.fechaFin = 'El regreso debe ser igual o posterior a la salida.'
    } else if (dias > MAX_DIAS_VIAJE) {
      e.fechaFin = `El viaje puede durar como máximo ${MAX_DIAS_VIAJE} días.`
    }
  }
  if (!Number.isInteger(f.personas) || f.personas < 1 || f.personas > 20) {
    e.personas = 'Entre 1 y 20 viajeros.'
  }
  if (!Number.isFinite(f.presupuesto) || f.presupuesto < 100) {
    e.presupuesto = 'El presupuesto mínimo es 100.'
  } else if (f.presupuesto > 10_000_000) {
    e.presupuesto = 'Ese presupuesto es demasiado alto.'
  }
  if (f.tipo === 'crucero' && !(f.zona ?? '').trim()) {
    e.zona = 'Indica la zona del crucero (p. ej., Caribe oriental).'
  }
  if ((f.descripcion ?? '').length > 2000) {
    e.descripcion = 'La descripción es demasiado larga.'
  }
  return e
}

/** Errores de zod del servidor (400 `campos`) → errores por campo. */
export function erroresDelServidor(data: unknown): ErroresFormulario {
  const campos =
    data && typeof data === 'object' && 'campos' in data
      ? (data as { campos?: unknown }).campos
      : null
  if (!campos || typeof campos !== 'object') return {}
  const e: ErroresFormulario = {}
  const validos: readonly CampoFormulario[] = [
    'descripcion',
    'destino',
    'origen',
    'fechaInicio',
    'fechaFin',
    'personas',
    'presupuesto',
    'tipo',
    'zona',
  ]
  for (const [k, v] of Object.entries(campos as Record<string, unknown>)) {
    const msg = Array.isArray(v) ? v.find((x) => typeof x === 'string') : null
    if (typeof msg === 'string' && (validos as readonly string[]).includes(k)) {
      e[k as CampoFormulario] = msg
    }
  }
  return e
}

/** Payload final: «Sorpréndeme» viaja como destino 'Sorpresa'. */
export function aPayload(f: FormularioViaje): FormularioViaje {
  const descripcion = (f.descripcion ?? '').trim()
  const lugares = (f.lugaresDeseados ?? []).filter((x) => x.trim())
  const zona = (f.zona ?? '').trim()
  const base: FormularioViaje = {
    destino: f.destinoSorpresa ? 'Sorpresa' : f.destino.trim(),
    destinoSorpresa: f.destinoSorpresa,
    origen: f.origen.trim(),
    personas: f.personas,
    fechaInicio: f.fechaInicio,
    fechaFin: f.fechaFin,
    presupuesto: f.presupuesto,
    moneda: f.moneda,
    tipo: f.tipo,
    paquete: f.paquete,
  }
  if (descripcion) base.descripcion = descripcion
  if (lugares.length > 0) base.lugaresDeseados = lugares.slice(0, 30)
  if (f.tipo === 'crucero' && zona) base.zona = zona
  if (f.preferencias && f.preferencias.length > 0)
    base.preferencias = f.preferencias.slice(0, 20)
  return base
}

// ── POST /api/interpret ────────────────────────────────────────────────────

export type CampoFaltante =
  | 'destino'
  | 'origen'
  | 'fechas'
  | 'personas'
  | 'presupuesto'

export interface InterpretResult {
  campos: Partial<{
    destino: string
    destinoSorpresa: boolean
    origen: string
    personas: number
    fechaInicio: string
    fechaFin: string
    presupuesto: number
    moneda: Moneda
    tipo: TipoViaje
    paquete: Paquete
    preferencias: string[]
    zona: string
    lugaresDeseados: string[]
  }>
  faltantes: CampoFaltante[]
  resumen: string
  supuestos: string[]
}
