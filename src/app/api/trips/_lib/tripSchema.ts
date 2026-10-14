import { z } from 'zod'
import { MONEDAS } from '@/lib/validations/tripForm'
import { sanearProfundo } from './texto'

/**
 * Validación del Trip que se guarda en trips.data (API-04). Objetivos:
 *  - Estructura y tipos correctos (lat/lng numéricos y en rango, arrays
 *    acotados, enums válidos).
 *  - Longitudes máximas en todos los textos.
 *  - Sin HTML: antes de validar, todo el JSON pasa por sanearProfundo (< y >
 *    se sustituyen), así que ni siquiera los campos desconocidos pueden
 *    inyectar etiquetas.
 * Es tolerante donde no hay riesgo (valores por defecto en vez de rechazar el
 * guardado) y conserva los campos que no conoce (looseObject) para no perder
 * datos que añadan otras partes de la app.
 */

/** Tamaño máximo del body de un viaje (bytes aprox.). */
export const MAX_TRIP_BYTES = 1_500_000

const TIPOS_ACTIVIDAD = [
  'museo',
  'restaurante',
  'templo',
  'parque',
  'barrio',
  'playa',
  'actividad',
  'traslado',
] as const

const ESTADOS_ACTIVIDAD = [
  'pendiente',
  'en_curso',
  'completada',
  'perdida',
  'recuperada',
] as const

const PAQUETES = ['basico', 'confort', 'premium'] as const

const URL_SEGURA = /^https?:\/\/[^\s]+$/i
const COLOR_SEGURO = /^(#[0-9a-f]{3,8}|[a-z]{3,20}|(rgb|hsl)a?\([\d\s.,%]+\))$/i

/** Texto recortado a `max` caracteres (no rechaza por largo). */
const texto = (max: number) => z.string().transform((s) => s.slice(0, max))

/** Array recortado a `max` elementos; si es inválido, vacío. */
const lista = <T extends z.ZodType>(item: T, max: number) =>
  z
    .array(item)
    .transform((a) => a.slice(0, max))
    .catch([])

const numero = (min: number, max: number, porDefecto: number) =>
  z.coerce.number().min(min).max(max).catch(porDefecto)

export const ActivityInputSchema = z.looseObject({
  id: z.string().min(1).max(100),
  nombre: texto(300).catch(''),
  descripcion: texto(3000).catch(''),
  horaInicio: texto(20).catch(''),
  horaFin: texto(20).catch(''),
  duracionMinutos: numero(0, 100_000, 0),
  tipo: z.enum(TIPOS_ACTIVIDAD).catch('actividad'),
  direccion: texto(500).catch(''),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  coordsVerificadas: z.boolean().optional().catch(undefined),
  radioGeofencingMetros: numero(0, 100_000, 100),
  precioEstimado: numero(0, 1_000_000_000, 0),
  reservaRequerida: z.boolean().catch(false),
  reservaPagada: z.boolean().catch(false),
  mejorHoraVisita: texto(200).catch(''),
  consejos: lista(texto(1000), 30),
  linkAfiliado: z
    .string()
    .max(2000)
    .regex(URL_SEGURA)
    .optional()
    .catch(undefined),
  tiempoHastaSiguiente: numero(0, 100_000, 0),
  estado: z.enum(ESTADOS_ACTIVIDAD).catch('pendiente'),
  esPerdida: z.boolean().catch(false),
  reagendadaDesdeDia: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .optional()
    .catch(undefined),
  tiempoEmbarqueMinutos: z
    .number()
    .min(0)
    .max(10_000)
    .optional()
    .catch(undefined),
  puertoCrucero: z.boolean().optional().catch(undefined),
})

export const DayInputSchema = z.looseObject({
  numero: z.coerce.number().int().min(0).max(1000).catch(1),
  titulo: texto(300).catch(''),
  descripcion: texto(3000).catch(''),
  ciudad: texto(200).catch(''),
  actividades: z.array(ActivityInputSchema).max(60),
  presupuestoDia: numero(0, 10_000_000_000, 0),
  colorMapa: z.string().max(40).regex(COLOR_SEGURO).catch('#14b8a6'),
})

export const TripInputSchema = z.looseObject({
  id: z
    .string()
    .min(1)
    .max(100)
    .catch(() => crypto.randomUUID()),
  destino: z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.slice(0, 200)),
  origen: texto(200).catch(''),
  personas: z.coerce.number().int().min(1).max(100).catch(1),
  fechaInicio: texto(40).catch(''),
  fechaFin: texto(40).catch(''),
  presupuestoTotal: numero(0, 10_000_000_000, 0),
  presupuestoPorPersona: numero(0, 10_000_000_000, 0),
  dias: z.array(DayInputSchema).max(60),
  paquete: z.enum(PAQUETES),
  moneda: z.enum(MONEDAS).optional().catch(undefined),
  resumenViaje: texto(5000).catch(''),
  consejos: lista(texto(1000), 50),
  advertencias: lista(texto(1000), 50),
  listaActividades: lista(texto(300), 400),
  actividadesPendientes: lista(ActivityInputSchema, 300),
})

export type TripInput = z.output<typeof TripInputSchema>
export type ActivityInput = z.output<typeof ActivityInputSchema>

export const ActividadesPendientesSchema = z.array(ActivityInputSchema).max(300)

export interface DetalleValidacion {
  campo: string
  mensaje: string
}

function detalles(error: z.ZodError): DetalleValidacion[] {
  return error.issues.slice(0, 5).map((i) => ({
    campo: i.path.map((p) => String(p)).join('.'),
    mensaje: i.message,
  }))
}

export type ResultadoTrip =
  | { ok: true; trip: TripInput }
  | { ok: false; detalles: DetalleValidacion[] }

/** Sanea y valida un Trip recibido del cliente. */
export function parsearTrip(raw: unknown): ResultadoTrip {
  const parsed = TripInputSchema.safeParse(sanearProfundo(raw))
  if (!parsed.success) return { ok: false, detalles: detalles(parsed.error) }
  return { ok: true, trip: parsed.data }
}

export type ResultadoActividades =
  | { ok: true; actividades: ActivityInput[] }
  | { ok: false; detalles: DetalleValidacion[] }

/** Sanea y valida una lista de actividades (actividades_pendientes). */
export function parsearActividades(raw: unknown): ResultadoActividades {
  const parsed = ActividadesPendientesSchema.safeParse(sanearProfundo(raw))
  if (!parsed.success) return { ok: false, detalles: detalles(parsed.error) }
  return { ok: true, actividades: parsed.data }
}
