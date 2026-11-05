import type { SocioAfiliado } from '@/constants/affiliateLinks'
import type { ProveedorAfiliado } from '@/lib/analytics/events'

/**
 * Socio del enlace → proveedor del catálogo de analítica. Hoy son el mismo
 * valor; la función queda como punto único por si el catálogo y los socios
 * dejan de coincidir.
 */
export function proveedorAnalitica(socio: SocioAfiliado): ProveedorAfiliado {
  return socio
}
