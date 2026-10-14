import type { Metadata } from 'next'
import { Suspense } from 'react'
import {
  PlanificadorCargando,
  PlannerFlow,
} from '@/components/planner/PlannerFlow'

export const metadata: Metadata = {
  title: 'Planificar viaje',
  description:
    'Cuéntanos qué imaginas y trazamos tres versiones de tu itinerario, con horarios, mapa y presupuesto en USD, EUR o DOP.',
  alternates: { canonical: '/planificar' },
}

/**
 * /planificar (docs/DISENO.md §6.2–§6.5): el flujo es un componente cliente
 * con el paso en la URL (?paso=datos|trazado|versiones|itinerario). Lee
 * useSearchParams, así que va dentro de Suspense con su esqueleto.
 */
export default function PlanificarPage() {
  return (
    <Suspense fallback={<PlanificadorCargando />}>
      <PlannerFlow />
    </Suspense>
  )
}
