import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

/**
 * Origen de una cifra de la calculadora: «real» (sale de la base de datos)
 * o «supuesto» (del informe o de lo que editó el dueño). Texto, no solo
 * color.
 */
export function Marca({
  real,
  className,
}: {
  real: boolean
  className?: string
}) {
  return (
    <Badge
      variant={real ? 'brand' : 'laton'}
      className={cn('align-middle text-[11px]', className)}
      title={
        real
          ? 'Dato real de la base de datos (ai_logs, suscripciones, viajes o contadores).'
          : 'Supuesto: cifra del informe o valor que editaste.'
      }
    >
      {real ? 'real' : 'supuesto'}
    </Badge>
  )
}
