import { z } from 'zod'

export const TripFormSchema = z.object({
  destino: z.string().min(2, 'Destino requerido'),
  destinoSorpresa: z.boolean().default(false),
  origen: z.string().min(2, 'Ciudad de origen requerida'),
  personas: z.number().min(1).max(20),
  fechaInicio: z.string().min(1),
  fechaFin: z.string().min(1),
  presupuesto: z.number().min(100),
  moneda: z.enum(['USD', 'EUR', 'DOP']).default('USD'),
  tipo: z.enum([
    'aventura',
    'relax',
    'cultura',
    'familia',
    'crucero',
    'romantico',
    'gastronomia',
  ]),
  paquete: z.enum(['basico', 'confort', 'premium']).default('confort'),
  preferencias: z.array(z.string()).optional(),
  zona: z.string().optional(),
})

export type TripForm = z.infer<typeof TripFormSchema>
