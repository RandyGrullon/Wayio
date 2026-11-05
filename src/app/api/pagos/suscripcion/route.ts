import { manejarSuscripcion } from '@/lib/pagos/rutas'

/**
 * POST /api/pagos/suscripcion — { accion: 'cancelar' | 'reanudar' }: programa
 * o deshace la baja al final del periodo pagado. Contrato en
 * src/lib/pagos/rutas.ts (manejarSuscripcion).
 */
export async function POST(request: Request): Promise<Response> {
  return manejarSuscripcion(request)
}
