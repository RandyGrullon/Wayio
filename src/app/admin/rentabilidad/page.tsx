import type { Metadata } from 'next'
import { Encabezado } from '@/components/admin/Encabezado'
import { CalculadoraRentabilidad } from '@/components/admin/rentabilidad/Calculadora'
import { exigirDueno } from '../_lib/acceso'
import { datosRentabilidad } from '../_lib/datos'

export const metadata: Metadata = { title: 'Rentabilidad · Admin' }

/**
 * Calculadora de rentabilidad: SOLO el dueño (WAYIO_OWNER_EMAILS). Otro
 * admin recibe un 404 (requireOwner). El Server Component lee los datos
 * reales y los supuestos (defaults 'server-only' + tabla privada) y los pasa
 * como props a la isla cliente, que recalcula al momento.
 */
export default async function RentabilidadPage() {
  if (!(await exigirDueno())) return null
  const props = await datosRentabilidad()

  return (
    <div className="space-y-8">
      <Encabezado
        titulo="Rentabilidad"
        descripcion="¿Gana o pierde dinero Wayio? Ingresos tras comisiones, costo de la IA por acción y por usuario, costos fijos y punto de equilibrio. Cada cifra va marcada «real» (base de datos) o «supuesto» (informe o lo que edites). Solo la ve el dueño."
      />
      <CalculadoraRentabilidad {...props} />
    </div>
  )
}
