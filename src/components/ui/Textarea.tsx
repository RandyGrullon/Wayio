'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode, Ref, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'
import { FieldLabel, FieldMessage, useFieldIds } from './Field'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: ReactNode
  error?: string | undefined
  optional?: boolean
  /** Muestra el contador «124/600» (requiere maxLength). Por defecto, sí. */
  showCount?: boolean
  /** Crece con el contenido hasta maxHeight (px). Por defecto, sí. */
  autoGrow?: boolean
  maxHeight?: number
  containerClassName?: string
  /** Contenido bajo el campo, antes del mensaje (chips de sugerencia…). */
  footer?: ReactNode
  ref?: Ref<HTMLTextAreaElement>
}

/**
 * Área de texto (docs/DISENO.md §5.2): min-h-32, crece con `field-sizing:
 * content` (y JS de respaldo) hasta 280 px, contador mono que pasa a aviso
 * cerca del límite.
 */
export function Textarea({
  label,
  hint,
  error,
  optional,
  showCount = true,
  autoGrow = true,
  maxHeight = 280,
  maxLength,
  className,
  containerClassName,
  footer,
  id,
  value,
  defaultValue,
  onChange,
  style,
  'aria-describedby': describedByProp,
  ref,
  ...props
}: TextareaProps) {
  const ids = useFieldIds({ id, hint, error, describedBy: describedByProp })
  const interno = useRef<HTMLTextAreaElement | null>(null)
  const [longitudLocal, setLongitudLocal] = useState(
    () => String(defaultValue ?? '').length
  )
  const longitud = value === undefined ? longitudLocal : String(value).length

  const ajustarAltura = useCallback(() => {
    const el = interno.current
    if (!el || !autoGrow) return
    // Respaldo para navegadores sin field-sizing: content.
    if (typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content'))
      return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [autoGrow, maxHeight])

  useEffect(() => {
    ajustarAltura()
  }, [ajustarAltura, value])

  const asignarRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      interno.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref]
  )

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (value === undefined) setLongitudLocal(e.target.value.length)
    ajustarAltura()
    onChange?.(e)
  }

  const contador = showCount && typeof maxLength === 'number'
  const cercaDelLimite = contador && longitud >= maxLength - 40

  return (
    <div className={cn('flex flex-col', containerClassName)}>
      {label ? (
        <FieldLabel htmlFor={ids.id} optional={optional}>
          {label}
        </FieldLabel>
      ) : null}
      <div className="relative">
        <textarea
          ref={asignarRef}
          id={ids.id}
          value={value}
          defaultValue={defaultValue}
          maxLength={maxLength}
          onChange={handleChange}
          aria-invalid={ids.invalid || undefined}
          aria-describedby={ids.describedBy}
          style={{ maxHeight, ...style }}
          className={cn(
            'block min-h-32 w-full resize-none rounded-control border border-border-strong bg-surface p-3.5 text-base leading-relaxed text-fg placeholder:text-fg-subtle',
            autoGrow && '[field-sizing:content]',
            'transition-[border-color,box-shadow] duration-(--dur-fast) ease-papel hover:border-fg-muted',
            'focus-visible:outline-none focus:border-ring focus:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)]',
            'aria-[invalid=true]:border-danger aria-[invalid=true]:shadow-[inset_0_0_0_1px_var(--danger)]',
            'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-subtle',
            contador && 'pb-8',
            className
          )}
          {...props}
        />
        {contador ? (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute right-3.5 bottom-2.5 font-mono text-[12px] tnum',
              cercaDelLimite ? 'text-warning' : 'text-fg-subtle'
            )}
          >
            {longitud}/{maxLength}
          </span>
        ) : null}
      </div>
      {footer ? <div className="mt-2.5">{footer}</div> : null}
      <FieldMessage ids={ids} hint={hint} error={error} />
    </div>
  )
}
