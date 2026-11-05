import { manejarCheckout } from '@/lib/pagos/rutas'

/**
 * POST /api/pagos/checkout — abre el pago de un plan con el proveedor activo
 * (PAYMENTS_PROVIDER: Creem por defecto, o Stripe). Contrato completo en
 * src/lib/pagos/rutas.ts (manejarCheckout).
 */
export async function POST(request: Request): Promise<Response> {
  return manejarCheckout(request)
}
