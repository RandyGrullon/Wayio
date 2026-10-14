'use client'

import { Segmented } from '@/components/ui/Segmented'
import { NIVELES, ORDEN_PAQUETES } from '@/components/planner/catalogo'
import type { TripForm } from '@/lib/validations/tripForm'

type Paquete = TripForm['paquete']

const OPCIONES = ORDEN_PAQUETES.map((p) => ({
  value: p,
  label: `${NIVELES[p].label} ${NIVELES[p].estrellas}★`,
  ariaLabel: `${NIVELES[p].label}, hoteles de ${NIVELES[p].estrellas} estrellas`,
}))

interface PackageSelectorProps {
  value: Paquete
  onChange: (paquete: Paquete) => void
  /** Nombre accesible del grupo (o labelledBy). */
  label?: string
  labelledBy?: string
  fullWidth?: boolean
  className?: string
}

/**
 * Nivel preferido (docs/DISENO.md §6.2, estación 05, y §6.4 en móvil):
 * Segmented «Básico 3★ | Confort 4★ | Premium 5★». Seleccionado = superficie
 * con thumb deslizante; radiogroup con flechas.
 */
export function PackageSelector({
  value,
  onChange,
  label,
  labelledBy,
  fullWidth = false,
  className,
}: PackageSelectorProps) {
  return (
    <Segmented
      options={OPCIONES}
      value={value}
      onValueChange={onChange}
      fullWidth={fullWidth}
      {...(label ? { label } : {})}
      {...(labelledBy ? { labelledBy } : {})}
      {...(className ? { className } : {})}
    />
  )
}
