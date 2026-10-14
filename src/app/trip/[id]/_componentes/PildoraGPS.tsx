'use client'

import { useState } from 'react'
import { LocateFixed, LocateOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { EstadoGPS } from '@/hooks/useGPS'
import { cn } from '@/lib/utils/cn'

interface PildoraGPSProps {
  estado: EstadoGPS
  error: string | null
  onActivar: () => void
  onDesactivar: () => void
  className?: string
}

/**
 * Pill de ubicación honesta (docs/DISENO.md §6.6): «Activar ubicación» →
 * «Activando…» → «Ubicación activa» (solo tras la primera posición) o
 * «Permiso denegado · Cómo activarlo».
 */
export function PildoraGPS({
  estado,
  error,
  onActivar,
  onDesactivar,
  className,
}: PildoraGPSProps) {
  const [ayuda, setAyuda] = useState(false)

  if (estado === 'no_disponible') {
    return (
      <p className={cn('text-caption text-fg-muted', className)}>
        Este navegador no permite usar la ubicación.
      </p>
    )
  }

  if (estado === 'denegada') {
    return (
      <>
        <button
          type="button"
          onClick={() => setAyuda(true)}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-full border border-border-strong bg-surface px-3.5 text-[14px] font-semibold text-fg hover:bg-surface-2 pointer-coarse:h-11',
            className
          )}
        >
          <LocateOff
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-4 text-danger"
          />
          Permiso denegado ·{' '}
          <span className="text-accent underline underline-offset-[3px]">
            Cómo activarlo
          </span>
        </button>
        <Modal
          open={ayuda}
          onClose={() => setAyuda(false)}
          title="Activar la ubicación"
          description="Wayio la usa solo mientras esta pantalla está abierta, para mostrarte dónde estás en el mapa."
          footer={
            <Button variant="outline" onClick={() => setAyuda(false)}>
              Entendido
            </Button>
          }
        >
          <ol className="list-decimal space-y-2 pl-5 text-body-s text-fg">
            <li>
              Toca el icono del candado o de ajustes junto a la dirección de
              esta página.
            </li>
            <li>
              En «Ubicación», elige <strong>Permitir</strong>.
            </li>
            <li>Vuelve aquí y pulsa «Activar ubicación».</li>
          </ol>
          <p className="mt-4 text-caption text-fg-muted">
            En iPhone, revisa también Ajustes › Privacidad › Localización ›
            Safari.
          </p>
        </Modal>
      </>
    )
  }

  if (estado === 'activa') {
    return (
      <button
        type="button"
        aria-pressed="true"
        onClick={onDesactivar}
        title="Pulsa para dejar de usar tu ubicación"
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-full border border-surface-inverse bg-surface-inverse px-3.5 text-[14px] font-semibold text-fg-inverse focus-visible:outline-ring pointer-coarse:h-11',
          className
        )}
      >
        <span aria-hidden="true" className="size-2 rounded-full bg-gps" />
        Ubicación activa
      </button>
    )
  }

  return (
    <div className={cn('flex flex-col items-start gap-1', className)}>
      <Button
        variant="outline"
        size="sm"
        icon={<LocateFixed />}
        loading={estado === 'activando'}
        loadingText="Activando…"
        onClick={estado === 'activando' ? onDesactivar : onActivar}
      >
        {estado === 'error' ? 'Reintentar ubicación' : 'Activar ubicación'}
      </Button>
      {error && estado === 'error' ? (
        <p role="status" className="text-caption text-fg-muted">
          {error}
        </p>
      ) : null}
    </div>
  )
}
