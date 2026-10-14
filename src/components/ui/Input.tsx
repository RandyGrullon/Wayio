import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  FieldLabel,
  FieldMessage,
  fieldClasses,
  useFieldIds,
  type FieldSize,
} from './Field'

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'size'
> {
  label?: string
  /** Texto de ayuda bajo el campo (caption). */
  hint?: ReactNode
  /** Mensaje de error: marca aria-invalid y tiene prioridad sobre el hint. */
  error?: string | undefined
  /** Icono inicial de 18 px (lucide). */
  icon?: ReactNode
  /** Contenido al final del campo (unidad, Segmented de moneda…). Ajusta el
   * padding derecho con className (p. ej. pr-[148px]). */
  suffix?: ReactNode
  /** Añade «(opcional)» al label. */
  optional?: boolean
  /** lg (52, público, por defecto) o md (44, admin y barras). */
  fieldSize?: FieldSize
  /** Clases del contenedor externo. */
  containerClassName?: string
  ref?: Ref<HTMLInputElement>
}

/**
 * Campo de texto (docs/DISENO.md §5.2). Texto a 16 px (evita el zoom de iOS),
 * foco con halo de --ring y error en --danger.
 */
export function Input({
  label,
  error,
  hint,
  icon,
  suffix,
  optional,
  fieldSize = 'lg',
  className,
  containerClassName,
  id,
  'aria-describedby': describedByProp,
  ref,
  ...props
}: InputProps) {
  const ids = useFieldIds({ id, hint, error, describedBy: describedByProp })
  return (
    <div className={cn('flex flex-col', containerClassName)}>
      {label ? (
        <FieldLabel htmlFor={ids.id} optional={optional}>
          {label}
        </FieldLabel>
      ) : null}
      <div className="relative">
        {icon ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-subtle [&_svg]:size-[18px] [&_svg]:stroke-[1.75]"
          >
            {icon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={ids.id}
          className={fieldClasses({
            size: fieldSize,
            conIcono: Boolean(icon),
            className: cn(suffix ? 'pr-14' : undefined, className),
          })}
          aria-invalid={ids.invalid || undefined}
          aria-describedby={ids.describedBy}
          {...props}
        />
        {suffix ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">
            {suffix}
          </div>
        ) : null}
      </div>
      <FieldMessage ids={ids} hint={hint} error={error} />
    </div>
  )
}
