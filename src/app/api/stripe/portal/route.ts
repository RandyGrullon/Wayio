import { manejarPortal } from '@/lib/pagos/rutas'

/**
 * POST /api/stripe/portal — ALIAS de /api/pagos/portal para las versiones ya
 * publicadas de la app móvil. Abre el portal del proveedor que cobra al
 * usuario (Creem o Stripe).
 */
export async function POST(request: Request): Promise<Response> {
  return manejarPortal(request)
}
