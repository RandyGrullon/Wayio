import { useId } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Piezas comunes de los campos de formulario (docs/DISENO.md §5.2): label,
 * hint y error enlazados por aria-describedby. El error tiene prioridad sobre
 * el hint y marca el control con aria-invalid.
 */

export type FieldSize = 'md' | 'lg'

/** Clases del control (input, select, textarea). md = admin, lg = público. */
export function fieldClasses({
  size = 'lg',
  conIcono = false,
  className,
}: {
  size?: FieldSize | undefined
  conIcono?: boolean | undefined
  className?: string | undefined
} = {}): string {
  return cn(
    'w-full rounded-control border border-border-strong bg-surface px-3.5 text-base text-fg placeholder:text-fg-subtle',
    'transition-[border-color,box-shadow] duration-(--dur-fast) ease-papel',
    'hover:border-fg-muted',
    'focus-visible:outline-none focus:border-ring focus:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)]',
    'aria-[invalid=true]:border-danger aria-[invalid=true]:shadow-[inset_0_0_0_1px_var(--danger)]',
    'aria-[invalid=true]:focus:shadow-[inset_0_0_0_1px_var(--danger),0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)]',
    'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-subtle disabled:hover:border-border-strong',
    size === 'lg' ? 'h-control-lg' : 'h-control-md',
    conIcono && 'pl-11',
    className
  )
}

export interface FieldIds {
  id: string
  /** id del label (para aria-labelledby de grupos como Segmented). */
  labelId: string
  hintId: string
  errorId: string
  /** Valor para aria-describedby del control (o undefined si no hay nada). */
  describedBy: string | undefined
  invalid: boolean
}

/** Genera los ids del campo y el aria-describedby combinado. */
export function useFieldIds({
  id,
  hint,
  error,
  describedBy,
}: {
  id?: string | undefined
  hint?: ReactNode
  error?: ReactNode
  describedBy?: string | undefined
}): FieldIds {
  const auto = useId()
  const base = id ?? `campo-${auto.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const hintId = `${base}-hint`
  const errorId = `${base}-error`
  const propio = error ? errorId : hint ? hintId : undefined
  const todos = [describedBy, propio].filter(Boolean).join(' ')
  return {
    id: base,
    labelId: `${base}-label`,
    hintId,
    errorId,
    describedBy: todos.length > 0 ? todos : undefined,
    invalid: Boolean(error),
  }
}

export function FieldLabel({
  htmlFor,
  id,
  optional,
  children,
  className,
}: {
  htmlFor?: string | undefined
  id?: string | undefined
  optional?: boolean | undefined
  children: ReactNode
  className?: string | undefined
}) {
  return (
    <label
      htmlFor={htmlFor}
      id={id}
      className={cn('mb-1.5 block text-label text-fg', className)}
    >
      {children}
      {optional ? (
        <span className="font-normal text-fg-subtle"> (opcional)</span>
      ) : null}
    </label>
  )
}

/** Hint o error bajo el campo (el error manda). */
export function FieldMessage({
  ids,
  hint,
  error,
}: {
  ids: Pick<FieldIds, 'hintId' | 'errorId'>
  hint?: ReactNode
  error?: ReactNode
}) {
  if (error) {
    return (
      <p
        id={ids.errorId}
        className="mt-1.5 flex animate-[wy-aparece_160ms_var(--ease-papel)_both] gap-1.5 text-[14px] text-danger"
      >
        <AlertCircle
          aria-hidden="true"
          strokeWidth={1.75}
          className="mt-[3px] size-4 shrink-0"
        />
        <span>{error}</span>
      </p>
    )
  }
  if (hint) {
    return (
      <p id={ids.hintId} className="mt-1.5 text-caption text-fg-muted">
        {hint}
      </p>
    )
  }
  return null
}

export interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  optional?: boolean
  id?: string
  className?: string
  /** Render prop: recibe los ids para enlazar el control. */
  children: (ids: FieldIds) => ReactNode
}

/**
 * Envoltorio genérico para controles propios (Segmented, StepCounter, chips…)
 * con la misma anatomía que Input.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  id,
  className,
  children,
}: FieldProps) {
  const ids = useFieldIds({ id, hint, error })
  return (
    <div className={cn('flex flex-col', className)}>
      {label ? (
        <FieldLabel htmlFor={ids.id} id={ids.labelId} optional={optional}>
          {label}
        </FieldLabel>
      ) : null}
      {children(ids)}
      <FieldMessage ids={ids} hint={hint} error={error} />
    </div>
  )
}
