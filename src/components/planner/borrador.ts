import {
  MAX_DIAS_VIAJE,
  MONEDAS,
  TIPOS_VIAJE,
  TripFormSchema,
  diasEntre,
  type Moneda,
  type TripForm,
} from '@/lib/validations/tripForm'
import {
  contarNoches,
  formatCurrency,
  formatNoches,
} from '@/lib/utils/formatters'

/**
 * Borrador del formulario del planificador (docs/DISENO.md §6.2): lo que el
 * usuario lleva escrito, aunque aún no sea válido. Vive en el estado del flujo
 * (sessionStorage) para que Atrás y recargar no lo pierdan, y se convierte en
 * un TripForm validado con zod al trazar.
 */

export type Paquete = TripForm['paquete']
export type TipoViaje = TripForm['tipo']

export { MAX_DESCRIPCION_VISUAL } from './catalogo'

export interface TripFormDraft {
  descripcion: string
  destinoSorpresa: boolean
  destino: string
  origen: string
  fechaInicio: string
  fechaFin: string
  personas: number
  /** Texto del input (puede estar vacío mientras se escribe). */
  presupuesto: string
  moneda: Moneda
  tipo: TipoViaje | ''
  zona: string
  paquete: Paquete
  preferencias: string[]
  lugaresDeseados: string[]
}

export function borradorVacio(): TripFormDraft {
  return {
    descripcion: '',
    destinoSorpresa: false,
    destino: '',
    origen: '',
    fechaInicio: '',
    fechaFin: '',
    personas: 2,
    presupuesto: '',
    moneda: 'USD',
    tipo: '',
    zona: '',
    paquete: 'confort',
    preferencias: [],
    lugaresDeseados: [],
  }
}

/** Borrador a partir de un formulario ya enviado (rehidratar al volver). */
export function borradorDesdeFormulario(f: TripForm): TripFormDraft {
  return {
    descripcion: f.descripcion ?? '',
    destinoSorpresa: f.destinoSorpresa,
    destino: f.destinoSorpresa ? '' : f.destino,
    origen: f.origen,
    fechaInicio: f.fechaInicio,
    fechaFin: f.fechaFin,
    personas: f.personas,
    presupuesto: String(f.presupuesto),
    moneda: f.moneda,
    tipo: f.tipo,
    zona: f.zona ?? '',
    paquete: f.paquete,
    preferencias: f.preferencias ?? [],
    lugaresDeseados: f.lugaresDeseados ?? [],
  }
}

// ─── Saneado (datos de sessionStorage) ─────────────────────────────────────

const esTexto = (v: unknown): v is string => typeof v === 'string'
const textos = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter(esTexto).slice(0, 30) : []

/** Valida y completa un borrador leído de almacenamiento. */
export function sanearBorrador(v: unknown): TripFormDraft {
  const base = borradorVacio()
  if (typeof v !== 'object' || v === null) return base
  const o = v as Record<string, unknown>
  const moneda = MONEDAS.find((m) => m === o['moneda'])
  const tipo = TIPOS_VIAJE.find((t) => t === o['tipo'])
  const paquete = (['basico', 'confort', 'premium'] as const).find(
    (p) => p === o['paquete']
  )
  const personas = Number(o['personas'])
  return {
    descripcion: esTexto(o['descripcion']) ? o['descripcion'] : '',
    destinoSorpresa: o['destinoSorpresa'] === true,
    destino: esTexto(o['destino']) ? o['destino'] : '',
    origen: esTexto(o['origen']) ? o['origen'] : '',
    fechaInicio: esTexto(o['fechaInicio']) ? o['fechaInicio'] : '',
    fechaFin: esTexto(o['fechaFin']) ? o['fechaFin'] : '',
    personas:
      Number.isInteger(personas) && personas >= 1 && personas <= 20
        ? personas
        : base.personas,
    presupuesto: esTexto(o['presupuesto']) ? o['presupuesto'] : '',
    moneda: moneda ?? base.moneda,
    tipo: tipo ?? '',
    zona: esTexto(o['zona']) ? o['zona'] : '',
    paquete: paquete ?? base.paquete,
    preferencias: textos(o['preferencias']),
    lugaresDeseados: textos(o['lugaresDeseados']),
  }
}

// ─── Campos, ids y etiquetas ───────────────────────────────────────────────

export type CampoForm =
  | 'descripcion'
  | 'destino'
  | 'origen'
  | 'fechaInicio'
  | 'fechaFin'
  | 'personas'
  | 'presupuesto'
  | 'moneda'
  | 'tipo'
  | 'zona'
  | 'paquete'

export type ErroresForm = Partial<Record<CampoForm, string>>

/** id del elemento a enfocar para cada campo (anclas del resumen de errores). */
export const ID_CAMPO: Record<CampoForm, string> = {
  descripcion: 'campo-descripcion',
  destino: 'campo-destino',
  origen: 'campo-origen',
  fechaInicio: 'fecha-inicio',
  fechaFin: 'fecha-fin',
  personas: 'campo-personas',
  presupuesto: 'campo-presupuesto',
  moneda: 'campo-presupuesto',
  tipo: 'campo-tipo',
  zona: 'campo-zona',
  paquete: 'campo-paquete',
}

export const ETIQUETA_CAMPO: Record<CampoForm, string> = {
  descripcion: 'Descripción',
  destino: 'Destino',
  origen: 'Ciudad de origen',
  fechaInicio: 'Salida',
  fechaFin: 'Regreso',
  personas: 'Viajeros',
  presupuesto: 'Presupuesto',
  moneda: 'Moneda',
  tipo: 'Estilo',
  zona: 'Zona del crucero',
  paquete: 'Nivel',
}

const ORDEN_CAMPOS: readonly CampoForm[] = [
  'descripcion',
  'destino',
  'origen',
  'fechaInicio',
  'fechaFin',
  'personas',
  'presupuesto',
  'moneda',
  'tipo',
  'zona',
  'paquete',
]

const esCampo = (k: unknown): k is CampoForm =>
  typeof k === 'string' && (ORDEN_CAMPOS as readonly string[]).includes(k)

/** Errores ordenados como aparecen en el formulario. */
export function erroresOrdenados(
  errores: ErroresForm
): Array<[CampoForm, string]> {
  return ORDEN_CAMPOS.flatMap((c) => {
    const e = errores[c]
    return e ? [[c, e] as [CampoForm, string]] : []
  })
}

/** Asigna a cada campo los errores de zod que devuelve el servidor (400). */
export function erroresDesdeServidor(campos: unknown): ErroresForm {
  const errores: ErroresForm = {}
  if (typeof campos !== 'object' || campos === null) return errores
  for (const [k, v] of Object.entries(campos)) {
    const campo: CampoForm | null =
      k === 'destinoSorpresa' ? 'destino' : esCampo(k) ? k : null
    const msg = Array.isArray(v) ? v.find(esTexto) : undefined
    if (campo && msg && !errores[campo]) errores[campo] = msg
  }
  return errores
}

// ─── Validación ────────────────────────────────────────────────────────────

export type ResultadoValidacion =
  | { ok: true; data: TripForm }
  | { ok: false; errores: ErroresForm }

/** Convierte el borrador en un TripForm válido o devuelve los errores por campo. */
export function aFormulario(b: TripFormDraft): ResultadoValidacion {
  const presupuestoTxt = b.presupuesto.trim().replace(/,/g, '')
  const descripcion = b.descripcion.trim()
  const candidato = {
    destino: b.destinoSorpresa ? 'Sorpresa' : b.destino.trim(),
    destinoSorpresa: b.destinoSorpresa,
    origen: b.origen.trim(),
    personas: b.personas,
    fechaInicio: b.fechaInicio,
    fechaFin: b.fechaFin,
    presupuesto: presupuestoTxt === '' ? Number.NaN : Number(presupuestoTxt),
    moneda: b.moneda,
    tipo: b.tipo === '' ? undefined : b.tipo,
    paquete: b.paquete,
    ...(b.preferencias.length > 0 ? { preferencias: b.preferencias } : {}),
    ...(b.tipo === 'crucero' && b.zona.trim() ? { zona: b.zona.trim() } : {}),
    ...(descripcion ? { descripcion } : {}),
    ...(b.lugaresDeseados.length > 0
      ? { lugaresDeseados: b.lugaresDeseados }
      : {}),
  }

  const errores: ErroresForm = {}
  const r = TripFormSchema.safeParse(candidato)
  if (!r.success) {
    for (const issue of r.error.issues) {
      const k = issue.path[0]
      const campo: CampoForm | null =
        k === 'destinoSorpresa' ? 'destino' : esCampo(k) ? k : null
      if (campo && !errores[campo]) errores[campo] = issue.message
    }
  }
  // Mensajes más claros para lo que falta (en vez de «Fecha inválida»).
  if (!b.destinoSorpresa && !b.destino.trim())
    errores.destino = 'Escribe a dónde quieres ir o elige «Sorpréndeme»'
  if (!b.origen.trim()) errores.origen = 'Indica desde qué ciudad sales'
  if (!b.fechaInicio) errores.fechaInicio = 'Elige la fecha de salida'
  if (!b.fechaFin) errores.fechaFin = 'Elige la fecha de regreso'
  if (presupuestoTxt === '') errores.presupuesto = 'Indica tu presupuesto'
  if (b.tipo === '') errores.tipo = 'Elige un estilo de viaje'
  if (b.tipo === 'crucero' && !b.zona.trim())
    errores.zona = 'Indica la zona del crucero'

  if (Object.keys(errores).length > 0 || !r.success) {
    return { ok: false, errores }
  }
  return { ok: true, data: r.data }
}

// ─── Estaciones ────────────────────────────────────────────────────────────

export type Estacion =
  | 'descripcion'
  | 'destino'
  | 'fechas'
  | 'viajeros'
  | 'estilo'
  | 'nivel'

/** Bloques válidos (la estación cambia de forma: número → Check). */
export function estacionesValidas(b: TripFormDraft): Record<Estacion, boolean> {
  const dias = diasEntre(b.fechaInicio, b.fechaFin)
  const presupuesto = Number(b.presupuesto.replace(/,/g, ''))
  return {
    descripcion: b.descripcion.trim().length >= 3,
    destino:
      (b.destinoSorpresa || b.destino.trim().length >= 2) &&
      b.origen.trim().length >= 2,
    fechas:
      Boolean(b.fechaInicio && b.fechaFin) &&
      dias >= 1 &&
      dias <= MAX_DIAS_VIAJE,
    viajeros:
      b.personas >= 1 &&
      b.personas <= 20 &&
      Number.isFinite(presupuesto) &&
      presupuesto >= 100,
    estilo: b.tipo !== '' && (b.tipo !== 'crucero' || b.zona.trim() !== ''),
    nivel: true,
  }
}

// ─── Resúmenes ─────────────────────────────────────────────────────────────

export function etiquetaDestino(
  b: Pick<TripFormDraft, 'destinoSorpresa' | 'destino'>
): string {
  if (b.destinoSorpresa) return 'Sorpresa'
  return b.destino.trim()
}

export function presupuestoNumero(
  b: Pick<TripFormDraft, 'presupuesto'>
): number | null {
  const n = Number(b.presupuesto.replace(/,/g, '').trim())
  return b.presupuesto.trim() && Number.isFinite(n) && n > 0 ? n : null
}

export function presupuestoTexto(b: TripFormDraft): string {
  const n = presupuestoNumero(b)
  return n === null ? '' : formatCurrency(n, b.moneda)
}

/** «Cartagena · 6 noches · 2» (barra móvil y acordeón de la ficha). */
export function resumenCorto(b: TripFormDraft): string {
  const partes: string[] = []
  const destino = etiquetaDestino(b)
  partes.push(destino || 'Tu viaje')
  const noches = contarNoches(b.fechaInicio, b.fechaFin)
  if (b.fechaInicio && b.fechaFin) partes.push(formatNoches(noches))
  partes.push(String(b.personas))
  return partes.join(' · ')
}
