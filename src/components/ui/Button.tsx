import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'outline' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon'
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'group relative inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        {
          'grad-brand text-white shadow-[0_8px_24px_-8px_rgba(20,184,166,0.6)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-8px_rgba(20,184,166,0.7)]':
            variant === 'primary',
          'bg-coral-500 text-white shadow-[0_8px_24px_-8px_rgba(251,82,52,0.6)] hover:-translate-y-0.5 hover:bg-coral-600':
            variant === 'accent',
          'bg-surface-muted text-fg hover:bg-border': variant === 'secondary',
          'border border-border-strong bg-surface text-fg hover:border-brand-400 hover:text-brand-600':
            variant === 'outline',
          'bg-transparent text-fg-muted hover:bg-surface-muted hover:text-fg':
            variant === 'ghost',
          'bg-red-600 text-white hover:bg-red-700': variant === 'danger',
          'h-9 px-3.5 text-sm': size === 'sm',
          'h-11 px-5 text-sm': size === 'md',
          'h-12 px-7 text-base': size === 'lg',
          'h-14 px-9 text-lg': size === 'xl',
          'h-10 w-10 p-0': size === 'icon',
          'w-full': fullWidth,
        },
        className
      )}
      disabled={disabled ?? loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  )
}
