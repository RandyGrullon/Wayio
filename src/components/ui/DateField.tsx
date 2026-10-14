'use client'

import { useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatResumenFechas, hoyLocal } from '@/lib/utils/formatters'
import { Input, type InputProps } from './Input'

export interface DateFieldProps extends Omit<InputProps, 'type'> {
  /** Resumen bajo el campo («sáb, 12 nov»), anunciado con aria-live. */
  resumen?: ReactNode
}

/**
 * Fecha nativa (docs/DISENO.md §5.2). El selector sigue el color-scheme del
 * tema. «Hoy» se calcula en hora local con hoyLocal().
 */
export function DateField({
  resumen,
  containerClassName,
  icon,
  ...props
}: DateFieldProps) {
  return (
    <div className={cn('flex flex-col', containerClassName)}>
      <Input
        type="date"
        icon={icon === undefined ? <CalendarDays /> : icon}
        className="tnum"
        {...props}
      />
      {resumen !== undefined ? (
        <p aria-live="polite" className="mt-1.5 text-caption text-fg-muted">
          {resumen}
        </p>
      ) : null}
    </div>
  )
}

const sinSuscripcion = () => () => {}
const sinValor = () => undefined

export interface DateRangeValue {
  inicio: string
  fin: string
}

export interface DateRangeFieldProps {
  value: DateRangeValue
  onChange: (valor: DateRangeValue) => void
  labelInicio?: string
  labelFin?: string
  idInicio?: string
  idFin?: string
  errorInicio?: string | undefined
  errorFin?: string | undefined
  /** Fecha mínima de salida (por defecto, hoy en hora local). */
  min?: string
  disabled?: boolean
  className?: string
}

/**
 * Salida y regreso (docs/DISENO.md §6.2): dos columnas desde xs, el regreso se
 * deshabilita sin salida y se limpia si queda antes; resumen «6 noches · sáb,
 * 12 nov → vie, 18 nov» con aria-live.
 */
export function DateRangeField({
  value,
  onChange,
  labelInicio = 'Salida',
  labelFin = 'Regreso',
  idInicio = 'fecha-inicio',
  idFin = 'fecha-fin',
  errorInicio,
  errorFin,
  min,
  disabled = false,
  className,
}: DateRangeFieldProps) {
  // «Hoy» solo en el cliente: el servidor puede estar en otra zona horaria.
  const hoy = useSyncExternalStore(sinSuscripcion, hoyLocal, sinValor)
  const minimo = min ?? hoy
  const resumen = formatResumenFechas(value.inicio, value.fin)
  return (
    <div className={className}>
      <div className="grid gap-4 xs:grid-cols-2">
        <DateField
          id={idInicio}
          label={labelInicio}
          min={minimo}
          value={value.inicio}
          error={errorInicio}
          disabled={disabled}
          onChange={(e) => {
            const inicio = e.target.value
            // Si el regreso queda antes de la nueva salida, se limpia.
            const fin =
              value.fin && inicio && value.fin < inicio ? '' : value.fin
            onChange({ inicio, fin })
          }}
        />
        <DateField
          id={idFin}
          label={labelFin}
          min={value.inicio || minimo}
          value={value.fin}
          error={errorFin}
          disabled={disabled || !value.inicio}
          hint={value.inicio ? undefined : 'Elige primero la salida'}
          onChange={(e) =>
            onChange({ inicio: value.inicio, fin: e.target.value })
          }
        />
      </div>
      <p
        aria-live="polite"
        className="mt-2 min-h-[1.4em] text-caption text-fg-muted tnum"
      >
        {resumen}
      </p>
    </div>
  )
}
