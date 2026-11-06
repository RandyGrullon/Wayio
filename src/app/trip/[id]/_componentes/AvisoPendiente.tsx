'use client'

import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import type { EstadoPendiente } from './useEdicionViaje'

interface AvisoPendienteProps {
  pendiente: EstadoPendiente
  aplicando: boolean
  online: boolean
  editando: boolean
  /** Mensaje del último guardado fallido (useTrip). */
  saveError: string | null
  /** `forzar`: aplicar aunque el viaje haya cambiado después. */
  onAplicar: (forzar: boolean) => void
  onDescartar: () => void
  className?: string
}

/**
 * Ajuste con IA (o deshacer) que no se guardó y se puede recuperar: falló el
 * guardado, llegó mientras se editaba o se guardaba otro cambio, o el viaje
 * cambió mientras la IA respondía (entonces se pide «Aplicar igualmente»).
 */
export function AvisoPendiente({
  pendiente,
  aplicando,
  online,
  editando,
  saveError,
  onAplicar,
  onDescartar,
  className,
}: AvisoPendienteProps) {
  const esIA = pendiente.tipo === 'ia'
  const sinAplicar = esIA ? 'Ajuste con IA sin aplicar' : 'Deshacer sin aplicar'

  const { tone, title, texto, accion, forzar } = editando
    ? {
        tone: 'info' as const,
        title: sinAplicar,
        texto: esIA
          ? 'Llegó mientras editabas. Guarda o descarta tu edición para poder aplicarlo.'
          : 'Guarda o descarta tu edición para poder deshacer.',
        accion: 'Aplicar',
        forzar: false,
      }
    : pendiente.desfasado
      ? {
          tone: 'warning' as const,
          title: esIA
            ? 'El viaje cambió desde este ajuste'
            : 'El viaje cambió desde que pediste deshacer',
          texto:
            'Si lo aplicas ahora, sustituye lo que se guardó después en tu viaje.',
          accion: 'Aplicar igualmente',
          forzar: true,
        }
      : pendiente.motivo === 'fallo'
        ? {
            tone: 'danger' as const,
            title: esIA
              ? 'No se guardó el ajuste con IA'
              : 'No pudimos deshacer el cambio',
            texto: `${saveError ?? 'No pudimos guardar los cambios.'} Tu viaje sigue como estaba.`,
            accion: 'Reintentar',
            forzar: false,
          }
        : {
            tone: 'info' as const,
            title: sinAplicar,
            texto: 'Llegó mientras se guardaba otro cambio de tu viaje.',
            accion: 'Aplicar ahora',
            forzar: false,
          }

  return (
    <Callout
      tone={tone}
      title={title}
      className={className}
      data-print="hide"
      action={
        <>
          <Button
            variant="link"
            disabled={editando || !online || aplicando}
            onClick={() => onAplicar(forzar)}
          >
            {accion}
          </Button>
          <Button variant="link" disabled={aplicando} onClick={onDescartar}>
            Descartar
          </Button>
        </>
      }
    >
      {texto}
    </Callout>
  )
}
