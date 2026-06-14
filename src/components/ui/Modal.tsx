'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        style={{ animation: 'wy-rise 0.2s ease-out' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'animate-rise relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-6 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.5)] sm:max-w-md sm:rounded-3xl',
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {title ? (
          <h2 className="mb-4 text-lg font-bold tracking-tight text-fg">
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </div>
  )
}
