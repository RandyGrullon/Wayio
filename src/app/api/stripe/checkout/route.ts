import { manejarCheckout } from '@/lib/pagos/rutas'

/**
 * POST /api/stripe/checkout — ALIAS de /api/pagos/checkout para las versiones
 * ya publicadas de la app móvil (y enlaces viejos). Usa el proveedor activo
 * (PAYMENTS_PROVIDER), no necesariamente Stripe. El código de Stripe vive en
 * src/lib/pagos/stripe/cobro.ts.
 */
export async function POST(request: Request): Promise<Response> {
  return manejarCheckout(request)
}
