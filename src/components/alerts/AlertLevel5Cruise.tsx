'use client'

import { MapPin, Ship } from 'lucide-react'
import type { Alert, AlertAction } from '@/types/alerts'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface AlertLevel5CruiseProps {
  alert: Alert
  /** «Ocultar por hoy» o cerrar: no debe reaparecer después. */
  onDismiss?: () => void
  /** 'navigate' = «Ver puerto en el mapa». */
  onAction?: (actionType: AlertAction['type']) => void
}

/**
 * Alerta de embarque del crucero (docs/DISENO.md §6.6): sheet con
 * role="alert", icono Ship, el aviso con la hora del embarque y las acciones
 * «Ver puerto en el mapa» y «Ocultar por hoy».
 */
export function AlertLevel5Cruise({
  alert,
  onDismiss,
  onAction,
}: AlertLevel5CruiseProps) {
  const cerrar = () => onDismiss?.()
  return (
    <Modal
      open
      onClose={cerrar}
      variant="sheet"
      title={
        <span className="inline-flex items-center gap-2.5">
          <Ship
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-6 shrink-0 text-warning"
          />
          {alert.title}
        </span>
      }
      className="mx-auto max-w-[560px] sm:mb-4 sm:rounded-sheet"
      footer={
        <>
          <Button variant="ghost" onClick={cerrar}>
            Ocultar por hoy
          </Button>
          {onAction ? (
            <Button
              variant="primary"
              icon={<MapPin />}
              onClick={() => onAction('navigate')}
              data-autofocus
            >
              Ver puerto en el mapa
            </Button>
          ) : null}
        </>
      }
    >
      <p role="alert" className="text-body text-fg">
        {alert.message}
      </p>
    </Modal>
  )
}
