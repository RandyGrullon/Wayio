'use client'

import { useState } from 'react'
import { Compass } from 'lucide-react'
import type { Trip } from '@/types/trip'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Modal'
import { cn } from '@/lib/utils/cn'
import { AdjustChat } from './AdjustChat'
import type { MensajeAjuste } from './AdjustChat'

interface AjustarConIAProps {
  trip: Trip
  onAdjusted: (trip: Trip, resumenCambios: string) => void
  puedeDeshacer: boolean
  onDeshacer: () => void
  /** Cierra el panel y entra en la edición manual. */
  onEditarManual?: () => void
  /** Separación extra del borde inferior (barra inferior fija). */
  conBarraInferior?: boolean
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
}: AjustarConIAProps) {
  const [abierto, setAbierto] = useState(false)
  const [historial, setHistorial] = useState<MensajeAjuste[]>([])

  return (
    <>
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

      <Drawer
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Ajustar con IA"
        description="Pide cambios en lenguaje natural. Siempre puedes deshacer el último ajuste."
      >
        <AdjustChat
          trip={trip}
          onAdjusted={onAdjusted}
          historial={historial}
          onMensaje={(m) => setHistorial((h) => [...h, m].slice(-30))}
          puedeDeshacer={puedeDeshacer}
          onDeshacer={onDeshacer}
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
