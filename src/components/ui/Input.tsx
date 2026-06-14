import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: ReactNode
}

export function Input({
  label,
  error,
  hint,
  icon,
  className,
  id,
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle">
            {icon}
          </span>
        ) : null}
        <input
          id={id}
          className={cn(
            'h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-fg shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all',
            'placeholder:text-fg-subtle',
            'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60',
            'focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15',
            icon && 'pl-10',
            error &&
              'border-red-500 focus:border-red-500 focus:ring-red-500/15',
            className
          )}
          aria-invalid={error ? true : undefined}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  )
}
