import { z } from 'zod'
import { MAX_DESCRIPCION, MONEDAS, TIPOS_VIAJE } from './tripForm'

/**
 * Contrato de POST /api/interpret: convierte una descripción libre del viaje
 * ("quiero ir a Japón 10 días en abril con mi pareja, unos 5000 dólares") en
 * los campos estructurados del formulario, para prellenarlo y preguntar solo
 * lo que falte.
 */
export const InterpretRequestSchema = z.object({
  texto: z.string().trim().min(3).max(MAX_DESCRIPCION),
  /** Fecha de hoy del usuario (YYYY-MM-DD) para resolver "en abril", "el finde". */
  hoy: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export type InterpretRequest = z.infer<typeof InterpretRequestSchema>

export const CAMPOS_INTERPRETABLES = [
  'destino',
  'origen',
  'fechas',
  'personas',
  'presupuesto',
] as const

export const InterpretResultSchema = z.object({
  campos: z.object({
    destino: z.string().optional(),
    destinoSorpresa: z.boolean().optional(),
    origen: z.string().optional(),
    personas: z.number().int().min(1).max(20).optional(),
    fechaInicio: z.string().optional(),
    fechaFin: z.string().optional(),
    presupuesto: z.number().min(0).optional(),
    moneda: z.enum(MONEDAS).optional(),
    tipo: z.enum(TIPOS_VIAJE).optional(),
    paquete: z.enum(['basico', 'confort', 'premium']).optional(),
    preferencias: z.array(z.string()).optional(),
    zona: z.string().optional(),
    lugaresDeseados: z.array(z.string()).optional(),
  }),
  /** Campos clave que la descripción no permite deducir y hay que preguntar. */
  faltantes: z.array(z.enum(CAMPOS_INTERPRETABLES)),
  /** Una frase que resume lo entendido, para mostrar al usuario. */
  resumen: z.string(),
  /** Supuestos que hizo la IA (p. ej. "asumí 2 personas por 'mi pareja y yo'"). */
  supuestos: z.array(z.string()),
})

export type InterpretResult = z.infer<typeof InterpretResultSchema>
