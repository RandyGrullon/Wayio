import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/** Lista etiqueta/valor de las fichas (Cuenta, Plan, Suscripción…). */
export function Datos({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <dl className={cn('divide-y divide-border', className)}>{children}</dl>
}

export function Dato({
  etiqueta,
  children,
}: {
  etiqueta: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-body-s text-fg-muted">{etiqueta}</dt>
      <dd className="min-w-0 text-right text-[14px] font-medium break-words text-fg">
        {children}
      </dd>
    </div>
  )
}
