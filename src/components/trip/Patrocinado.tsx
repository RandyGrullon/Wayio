import { AVISO_PATROCINADO } from '@/constants/affiliateLinks'
import { cn } from '@/lib/utils/cn'

/**
 * Aviso de enlaces patrocinados (FTC y LSSI) junto a los botones de reserva.
 * Siempre visible: aunque falte algún ID, el enlace puede ser de afiliado.
 */
export function AvisoPatrocinado({ className }: { className?: string }) {
  return (
    <p className={cn('text-caption text-fg-subtle', className)}>
      {AVISO_PATROCINADO}
    </p>
  )
}

/**
 * Etiqueta corta junto a un botón de reserva de una fila (donde el aviso
 * completo recargaría la interfaz). El botón ya anuncia «enlace patrocinado»
 * a los lectores de pantalla, por eso esta queda oculta para ellos.
 */
export function EtiquetaPatrocinado({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      title={AVISO_PATROCINADO}
      className={cn('text-caption text-fg-subtle', className)}
    >
      Patrocinado
    </span>
  )
}
