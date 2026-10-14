import type { HTMLAttributes, ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type CalloutTone = 'info' | 'success' | 'warning' | 'danger'

const TONOS: Record<CalloutTone, { clases: string; Icono: LucideIcon }> = {
  info: { clases: 'bg-info-bg border-info/30 text-info-fg', Icono: Info },
  success: {
    clases: 'bg-success-bg border-success/30 text-success-fg',
    Icono: CheckCircle2,
  },
  warning: {
    clases: 'bg-warning-bg border-warning/30 text-warning-fg',
    Icono: AlertTriangle,
  },
  danger: {
    clases: 'bg-danger-bg border-danger/30 text-danger-fg',
    Icono: AlertCircle,
  },
}

export interface CalloutProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title'
> {
  tone?: CalloutTone
  title?: ReactNode
  /** Sustituye el icono por defecto del tono (p. ej. CloudOff). */
  icon?: LucideIcon
  /** Acción opcional (un Button variant="link" o un enlace). */
  action?: ReactNode
}

/**
 * Aviso en línea (docs/DISENO.md §5.4). Sustituye a todos los avisos hechos a
 * mano. danger → role="alert"; el resto → role="status".
 */
export function Callout({
  tone = 'info',
  title,
  icon,
  action,
  className,
  children,
  role,
  ...props
}: CalloutProps) {
  const { clases, Icono: IconoTono } = TONOS[tone]
  const Icono = icon ?? IconoTono
  return (
    <div
      role={role ?? (tone === 'danger' ? 'alert' : 'status')}
      className={cn(
        'flex gap-3 rounded-card border p-4 text-body-s',
        clases,
        className
      )}
      {...props}
    >
      <Icono
        aria-hidden="true"
        strokeWidth={1.75}
        className="mt-0.5 size-5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        {title ? (
          <p className="text-[15px] leading-snug font-semibold">{title}</p>
        ) : null}
        {children ? (
          <div className={cn(title ? 'mt-0.5' : undefined)}>{children}</div>
        ) : null}
        {action ? (
          <div className="mt-2.5 flex flex-wrap gap-3">{action}</div>
        ) : null}
      </div>
    </div>
  )
}
