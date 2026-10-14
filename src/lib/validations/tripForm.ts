import { z } from 'zod'

/** Duración máxima de un viaje que la IA planifica de una sola vez. */
export const MAX_DIAS_VIAJE = 30

/** Largo máximo de la descripción libre ("cuéntanos tu viaje ideal"). */
export const MAX_DESCRIPCION = 2000

export const MONEDAS = ['USD', 'EUR', 'DOP'] as const
export type Moneda = (typeof MONEDAS)[number]

export const TIPOS_VIAJE = [
  'aventura',
  'relax',
  'cultura',
  'familia',
  'crucero',
  'romantico',
  'gastronomia',
] as const

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

/** Días de viaje (ambos extremos incluidos) entre dos fechas ISO YYYY-MM-DD. */
export function diasEntre(fechaInicio: string, fechaFin: string): number {
  const ini = Date.parse(`${fechaInicio}T00:00:00Z`)
  const fin = Date.parse(`${fechaFin}T00:00:00Z`)
  if (!Number.isFinite(ini) || !Number.isFinite(fin)) return 0
  return Math.round((fin - ini) / 86_400_000) + 1
}

export const TripFormSchema = z
  .object({
    destino: z.string().trim().min(2, 'Destino requerido').max(120),
    destinoSorpresa: z.boolean().default(false),
    origen: z.string().trim().min(2, 'Ciudad de origen requerida').max(120),
    personas: z
      .number({ error: 'Indica cuántas personas viajan' })
      .int('Indica un número entero de personas')
      .min(1, 'Mínimo 1 persona')
      .max(20, 'Máximo 20 personas'),
    fechaInicio: z.string().regex(FECHA_ISO, 'Fecha de salida inválida'),
    fechaFin: z.string().regex(FECHA_ISO, 'Fecha de regreso inválida'),
    presupuesto: z
      .number({ error: 'Indica tu presupuesto' })
      .min(100, 'El presupuesto mínimo es 100')
      .max(10_000_000, 'Presupuesto demasiado alto'),
    moneda: z.enum(MONEDAS).default('USD'),
    tipo: z.enum(TIPOS_VIAJE, { error: 'Elige un tipo de viaje' }),
    paquete: z.enum(['basico', 'confort', 'premium']).default('confort'),
    preferencias: z.array(z.string().trim().max(80)).max(20).optional(),
    zona: z.string().trim().max(120).optional(),
    /**
     * Descripción libre del viaje en lenguaje natural ("vamos con dos niños,
     * odiamos madrugar, queremos un día de playa..."). La IA la trata como la
     * fuente principal de preferencias y restricciones.
     */
    descripcion: z.string().trim().max(MAX_DESCRIPCION).optional(),
    /** Lugares concretos que el usuario quiere visitar (p. ej. desde un video). */
    lugaresDeseados: z.array(z.string().trim().max(120)).max(30).optional(),
  })
  .superRefine((f, ctx) => {
    const dias = diasEntre(f.fechaInicio, f.fechaFin)
    if (dias < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['fechaFin'],
        message:
          'La fecha de regreso debe ser igual o posterior a la de salida',
      })
    } else if (dias > MAX_DIAS_VIAJE) {
      ctx.addIssue({
        code: 'custom',
        path: ['fechaFin'],
        message: `El viaje puede durar como máximo ${MAX_DIAS_VIAJE} días`,
      })
    }
  })

export type TripForm = z.infer<typeof TripFormSchema>
