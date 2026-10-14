import type { ReactNode, Ref, SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  FieldLabel,
  FieldMessage,
  fieldClasses,
  useFieldIds,
  type FieldSize,
} from './Field'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'size'
> {
  label?: string
  hint?: ReactNode
  error?: string | undefined
  optional?: boolean
  icon?: ReactNode
  /** Opciones; alternativa a pasar <option> como children. */
  options?: readonly SelectOption[]
  /** Primera opción vacía y deshabilitada («Elige…»). */
  placeholder?: string
  fieldSize?: FieldSize
  containerClassName?: string
  ref?: Ref<HTMLSelectElement>
}

/** Select nativo con la anatomía de Input (docs/DISENO.md §5.2). */
export function Select({
  label,
  hint,
  error,
  optional,
  icon,
  options,
  placeholder,
  fieldSize = 'lg',
  className,
  containerClassName,
  id,
  children,
  'aria-describedby': describedByProp,
  ref,
  ...props
}: SelectProps) {
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
        <select
          ref={ref}
          id={ids.id}
          aria-invalid={ids.invalid || undefined}
          aria-describedby={ids.describedBy}
          className={fieldClasses({
            size: fieldSize,
            conIcono: Boolean(icon),
            className: cn('cursor-pointer appearance-none pr-10', className),
          })}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options?.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.75}
          className="pointer-events-none absolute top-1/2 right-3.5 size-[18px] -translate-y-1/2 text-fg-muted"
        />
      </div>
      <FieldMessage ids={ids} hint={hint} error={error} />
    </div>
  )
}
