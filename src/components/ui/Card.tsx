import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated' | 'glass'
  interactive?: boolean
}

export function Card({
  variant = 'default',
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl p-6',
        {
          'border border-border bg-surface shadow-[var(--shadow-soft)]':
            variant === 'default',
          'border border-border bg-surface': variant === 'bordered',
          'border border-border bg-surface shadow-[0_24px_60px_-24px_rgba(15,23,42,0.35)]':
            variant === 'elevated',
          glass: variant === 'glass',
          'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-brand-300 hover:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.35)]':
            interactive,
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
