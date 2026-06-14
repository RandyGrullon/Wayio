import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'brand' | 'accent' | 'success' | 'warning' | 'error'
}

export function Badge({
  variant = 'default',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        {
          'bg-surface-muted text-fg-muted ring-border': variant === 'default',
          'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30':
            variant === 'brand',
          'bg-coral-50 text-coral-700 ring-coral-200 dark:bg-coral-500/10 dark:text-coral-300 dark:ring-coral-500/30':
            variant === 'accent',
          'bg-green-50 text-green-700 ring-green-200 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-500/30':
            variant === 'success',
          'bg-sun-50 text-sun-700 ring-sun-200 dark:bg-sun-500/10 dark:text-sun-300 dark:ring-sun-500/30':
            variant === 'warning',
          'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30':
            variant === 'error',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
