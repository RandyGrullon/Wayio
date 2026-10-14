'use client'

import { useId } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from './Button'

export interface StepCounterProps {
  value: number
  onChange: (valor: number) => void
  min?: number
  max?: number
  /** Etiqueta visible del grupo («Viajeros»). */
  label?: string
  /** aria-label de los botones. */
  labelQuitar?: string
  labelAnadir?: string
  /** Texto tras el número para lectores de pantalla («viajeros»). */
  unidad?: string
  /** Si se da, añade un input oculto para formularios nativos. */
  name?: string
  disabled?: boolean
  className?: string
  /** id(s) del texto que describe el control (p. ej. su mensaje de error). */
  'aria-describedby'?: string | undefined
  /**
   * Control con error. role="group" no admite aria-invalid (ARIA 1.2), así
   * que el error se anuncia con aria-describedby y aquí se refleja en el
   * filete de los botones y en data-invalid.
   */
  'aria-invalid'?: boolean | undefined
}

/** Acota a [min, max] y nunca devuelve NaN. */
function acotar(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}

/**
 * Stepper de cantidad (docs/DISENO.md §5.2): [−] valor [+] con botones
 * outline de 44 px, valor tnum de 20 px anunciado con aria-live. Rango 1–20
 * por defecto, con guarda (nunca produce NaN).
 *
 * aria-describedby va en los dos botones: son lo único que recibe el foco
 * (la descripción de un role="group" no la anuncian todos los lectores).
 */
export function StepCounter({
  value,
  onChange,
  min = 1,
  max = 20,
  label,
  labelQuitar = 'Quitar viajero',
  labelAnadir = 'Añadir viajero',
  unidad,
  name,
  disabled = false,
  className,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
}: StepCounterProps) {
  const id = useId()
  const actual = acotar(value, min, max)
  const invalido = ariaInvalid === true
  const descripcion = describedBy || undefined
  const claseBoton = invalido ? 'border-danger' : undefined
  return (
    <div
      role="group"
      aria-labelledby={label ? `${id}-label` : undefined}
      data-invalid={invalido || undefined}
      className={cn('flex flex-col', className)}
    >
      {label ? (
        <span id={`${id}-label`} className="mb-1.5 block text-label text-fg">
          {label}
        </span>
      ) : null}
      <div className="inline-flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          aria-label={labelQuitar}
          aria-describedby={descripcion}
          disabled={disabled || actual <= min}
          onClick={() => onChange(acotar(actual - 1, min, max))}
          icon={<Minus strokeWidth={1.75} />}
          className={claseBoton}
        />
        <output
          aria-live="polite"
          className="min-w-[2.5ch] text-center text-[20px] font-semibold text-fg tnum"
        >
          {actual}
          {unidad ? <span className="sr-only"> {unidad}</span> : null}
        </output>
        <Button
          variant="outline"
          size="icon"
          aria-label={labelAnadir}
          aria-describedby={descripcion}
          disabled={disabled || actual >= max}
          onClick={() => onChange(acotar(actual + 1, min, max))}
          icon={<Plus strokeWidth={1.75} />}
          className={claseBoton}
        />
      </div>
      {name ? <input type="hidden" name={name} value={actual} /> : null}
    </div>
  )
}
