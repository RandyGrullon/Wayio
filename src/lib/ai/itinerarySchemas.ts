import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

/**
 * Esquemas de salida estructurada de la IA para generar itinerarios.
 *
 * Con Anthropic se envían como `output_config.format` (JSON garantizado que
 * cumple el esquema). Con Groq se usan como guía en el prompt + JSON mode.
 * La salida SIEMPRE pasa después por normalize.ts (no confiamos a ciegas).
 *
 * Reglas para que el esquema sea compatible con structured outputs: todas las
 * propiedades requeridas (lo opcional se expresa como `null`) y sin
 * restricciones numéricas/longitud (se validan después al normalizar).
 */

const TIPO = z.enum([
  'museo',
  'restaurante',
  'templo',
  'parque',
  'barrio',
  'playa',
  'actividad',
  'traslado',
])

/** Alternativa de una actividad para el paquete básico o premium. */
export const VarianteSchema = z.object({
  nombre: z.string(),
  descripcion: z.string(),
  tipo: TIPO,
  direccion: z.string(),
  lat: z.number(),
  lng: z.number(),
  precioEstimado: z.number(),
  reservaRequerida: z.boolean(),
})

export const ActividadSchema = z.object({
  nombre: z.string().describe('Nombre real y concreto del lugar o experiencia'),
  descripcion: z
    .string()
    .describe('1-2 frases útiles: qué hacer y por qué vale la pena'),
  horaInicio: z.string().describe('HH:MM, 24 h'),
  horaFin: z.string().describe('HH:MM, 24 h'),
  duracionMinutos: z.number(),
  tipo: TIPO,
  direccion: z.string().describe('Dirección o zona real, con ciudad'),
  lat: z.number().describe('Latitud real del lugar'),
  lng: z.number().describe('Longitud real del lugar'),
  precioEstimado: z
    .number()
    .describe(
      'Coste TOTAL para todo el grupo, en la moneda del viaje (0 si es gratis)'
    ),
  reservaRequerida: z.boolean(),
  mejorHoraVisita: z.string(),
  consejos: z.array(z.string()).describe('0-2 consejos prácticos y concretos'),
  tiempoHastaSiguiente: z
    .number()
    .describe(
      'Minutos de traslado hasta la siguiente actividad (0 si es la última)'
    ),
  puertoCrucero: z
    .boolean()
    .describe('true solo si es el muelle/terminal del crucero'),
  tiempoEmbarqueMinutos: z
    .number()
    .describe(
      'Solo crucero: minutos antes del zarpe en que cierra el embarque; 0 si no aplica'
    ),
  variantesTier: z
    .object({
      basico: VarianteSchema.nullable(),
      premium: VarianteSchema.nullable(),
    })
    .nullable()
    .describe(
      'Alternativas para los paquetes básico y premium. null en traslados y lugares gratuitos iguales para todos'
    ),
})

export const DiaSchema = z.object({
  numero: z.number(),
  ciudad: z.string(),
  titulo: z.string().describe('Título corto y evocador del día'),
  descripcion: z.string().describe('1-2 frases sobre el plan del día'),
  presupuestoDia: z
    .number()
    .describe(
      'Gasto total del día para el grupo (actividades + comidas + transporte local + alojamiento si se paga ese día), en la moneda del viaje'
    ),
  actividades: z.array(ActividadSchema),
})

const ResumenViajeFields = {
  destino: z
    .string()
    .describe(
      'Nombre real del destino (ciudad, región o país); nunca "Sorpresa"'
    ),
  resumenViaje: z
    .string()
    .describe('2-3 frases que vendan el viaje y su lógica'),
  vueloIdaVueltaPorPersona: z
    .number()
    .describe(
      'Estimación del vuelo ida y vuelta desde el origen por persona, en la moneda del viaje; 0 si no hace falta volar'
    ),
  advertencias: z
    .array(z.string())
    .describe(
      'Problemas reales: presupuesto insuficiente, cierres, visados, clima, temporada…'
    ),
  consejos: z.array(z.string()).describe('3-6 consejos prácticos del viaje'),
}

/** Viaje completo de una sola llamada (viajes cortos). */
export const ViajeCompletoSchema = z.object({
  ...ResumenViajeFields,
  dias: z.array(DiaSchema),
})

/** Estancia en una ciudad (alojamiento por paquete) dentro del esqueleto. */
const EstanciaSchema = z.object({
  ciudad: z.string(),
  desdeDia: z.number(),
  hastaDia: z.number().describe('Último día que se duerme en esta ciudad'),
  zona: z.string().describe('Barrio recomendado para alojarse'),
  hotelBasico: z.string(),
  hotelConfort: z.string(),
  hotelPremium: z.string(),
  costeTotalBasico: z
    .number()
    .describe('Coste de TODAS las noches para el grupo'),
  costeTotalConfort: z.number(),
  costeTotalPremium: z.number(),
})

/**
 * Esqueleto del viaje (primer paso en viajes largos): reparte ciudades y
 * prioridades por día y fija los hoteles, para que luego cada bloque de días
 * se genere en paralelo sin repetir lugares ni romper la ruta.
 */
export const EsqueletoSchema = z.object({
  ...ResumenViajeFields,
  presupuestoActividadesPorDia: z
    .number()
    .describe(
      'Gasto objetivo por día (sin alojamiento) para el paquete confort, para el grupo'
    ),
  estancias: z.array(EstanciaSchema),
  dias: z.array(
    z.object({
      numero: z.number(),
      ciudad: z.string(),
      titulo: z.string(),
      foco: z.string().describe('Qué se hace ese día y por qué en ese orden'),
      lugaresClave: z
        .array(z.string())
        .describe(
          '3-6 lugares concretos asignados a ESTE día (no repetir entre días)'
        ),
      esDiaDeTraslado: z
        .boolean()
        .describe(
          'true si ese día se viaja entre ciudades o se llega/sale del destino'
        ),
    })
  ),
})

/** Bloque de días detallados (segundo paso, en paralelo). */
export const BloqueDiasSchema = z.object({
  dias: z.array(DiaSchema),
})

export type ActividadIA = z.infer<typeof ActividadSchema>
export type DiaIA = z.infer<typeof DiaSchema>
export type ViajeCompletoIA = z.infer<typeof ViajeCompletoSchema>
export type EsqueletoIA = z.infer<typeof EsqueletoSchema>
export type BloqueDiasIA = z.infer<typeof BloqueDiasSchema>

const cache = new Map<z.ZodType, Record<string, unknown>>()

/** JSON Schema (formato structured outputs de Anthropic) de un esquema zod. */
export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const hit = cache.get(schema)
  if (hit) return hit
  const fmt = zodOutputFormat(schema)
  const json = fmt.schema
  cache.set(schema, json)
  return json
}
