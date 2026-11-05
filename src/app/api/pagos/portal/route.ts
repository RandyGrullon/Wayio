import { manejarPortal } from '@/lib/pagos/rutas'

/**
 * POST /api/pagos/portal — portal de pagos (método de pago, facturas,
 * cancelar) del proveedor que cobra al usuario. Contrato en
 * src/lib/pagos/rutas.ts (manejarPortal).
 */
export async function POST(request: Request): Promise<Response> {
  return manejarPortal(request)
}
