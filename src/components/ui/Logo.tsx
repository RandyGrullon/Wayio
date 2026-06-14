import { cn } from '@/lib/utils/cn'

export function Logo({
  className,
  showText = true,
}: {
  className?: string
  showText?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="grad-brand inline-flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-[0_8px_20px_-8px_rgba(20,184,166,0.7)]">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 2C7.6 2 4 5.6 4 10c0 5.2 6.4 11.3 7.3 12.1.4.4 1 .4 1.4 0C13.6 21.3 20 15.2 20 10c0-4.4-3.6-8-8-8Z"
            fill="currentColor"
            opacity="0.25"
          />
          <circle cx="12" cy="10" r="3" fill="currentColor" />
        </svg>
      </span>
      {showText ? (
        <span className="text-xl font-extrabold tracking-tight text-fg">
          Way<span className="text-gradient">io</span>
        </span>
      ) : null}
    </span>
  )
}
