'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Compass } from 'lucide-react'
import type { Trip } from '@/types/trip'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Modal'
import { cn } from '@/lib/utils/cn'
import { AdjustChat } from './AdjustChat'
import type { MensajeAjuste } from './AdjustChat'

interface AjustarConIAProps {
  trip: Trip
  /** El tercer argumento es el viaje que se envió a la IA (ver AdjustChat). */
  onAdjusted: (trip: Trip, resumenCambios: string, enviado: Trip) => void
  puedeDeshacer: boolean
  onDeshacer: () => void
  /** Cierra el panel y entra en la edición manual. */
  onEditarManual?: () => void
  /** Separación extra del borde inferior (barra inferior fija). */
  conBarraInferior?: boolean
  /** Ruta a la que volver tras iniciar sesión (401); ver AdjustChat. */
  loginRedirect?: string
  /** Se está aplicando el último ajuste: no se puede pedir otro todavía. */
  ocupado?: boolean
  /**
   * Oculta el FAB (p. ej. durante la edición manual) sin desmontar: el
   * historial de la conversación se conserva para cuando vuelva.
   */
  oculto?: boolean
  /** No se puede pedir otro ajuste (p. ej. hay uno pendiente de aplicar). */
  bloqueado?: boolean
  /** Aviso sobre el chat, dentro del panel (p. ej. el ajuste pendiente). */
  aviso?: ReactNode
}

/**
 * FAB «Ajustar con IA» (tinta, 52 px, Compass) y su panel: drawer de 420 px
 * desde 1024 y sheet por debajo. El historial vive aquí para no perderse al
 * cerrar el panel. Oculto al imprimir.
 */
export function AjustarConIA({
  trip,
  onAdjusted,
  puedeDeshacer,
  onDeshacer,
  onEditarManual,
  conBarraInferior = false,
  loginRedirect,
  ocupado = false,
  oculto = false,
  bloqueado = false,
  aviso,
}: AjustarConIAProps) {
  const [abierto, setAbierto] = useState(false)
  const [historial, setHistorial] = useState<MensajeAjuste[]>([])
  // Al ocultarse, el panel se cierra (y no se reabre solo al volver).
  if (oculto && abierto) setAbierto(false)

  return (
    <>
      {oculto ? null : (
        <div
          data-print="hide"
          className={cn(
            'fixed right-4 z-(--z-dropdown) md:right-6',
            conBarraInferior
              ? 'bottom-[calc(88px+env(safe-area-inset-bottom))] md:bottom-6'
              : 'bottom-[max(16px,env(safe-area-inset-bottom))] md:bottom-6'
          )}
        >
          <Button
            variant="tinta"
            icon={<Compass />}
            aria-haspopup="dialog"
            aria-expanded={abierto}
            onClick={() => setAbierto(true)}
            className="h-[52px] px-5 text-[15px] shadow-float"
          >
            Ajustar con IA
          </Button>
        </div>
      )}

      <Drawer
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Ajustar con IA"
        description="Pide cambios en lenguaje natural. Siempre puedes deshacer el último ajuste."
      >
        {aviso ? <div className="mb-4">{aviso}</div> : null}
        <AdjustChat
          trip={trip}
          onAdjusted={onAdjusted}
          historial={historial}
          onMensaje={(m) => setHistorial((h) => [...h, m].slice(-30))}
          puedeDeshacer={puedeDeshacer}
          onDeshacer={onDeshacer}
          ocupado={ocupado}
          bloqueado={bloqueado}
          {...(loginRedirect ? { loginRedirect } : {})}
          {...(onEditarManual
            ? {
                onEditarManual: () => {
                  setAbierto(false)
                  onEditarManual()
                },
              }
            : {})}
        />
      </Drawer>
    </>
  )
}
