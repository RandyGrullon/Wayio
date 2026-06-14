import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-surface-muted',
        className
      )}
      {...props}
    >
      <div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/5"
        style={{ animation: 'wy-shimmer 1.6s infinite' }}
      />
    </div>
  )
}
