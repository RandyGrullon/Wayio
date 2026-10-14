'use client'

import { useState } from 'react'
import { m } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Dices,
  MapPin,
  RotateCcw,
  Table2,
  Users,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Chip } from '@/components/ui/Chip'
import { Modal } from '@/components/ui/Modal'
import { useToastOffset } from '@/components/ui/Toast'
import {
  PackageCompare,
  TablaComparativa,
  idTarjetaVersion,
} from '@/components/trip/PackageCompare'
import { PackageSelector } from '@/components/trip/PackageSelector'
import type { GenerateResult } from '@/lib/ai/generateTrips'
import type { TripForm } from '@/lib/validations/tripForm'
import {
  contarNoches,
  formatCurrency,
  formatNoches,
  formatRangoFechas,
  formatViajeros,
} from '@/lib/utils/formatters'
import type { CampoForm, Paquete } from './borrador'
import { BarraInferior } from './BarraInferior'
import { NIVELES } from './catalogo'

/**
 * Paso «versiones» (docs/DISENO.md §6.4): resumen editable de la búsqueda,
 * tres versiones en radiogroup (seleccionar no navega) y barra inferior con
 * «Ver itinerario <nivel>» y «Comparar en tabla».
 */

export interface PasoVersionesProps {
  resultado: GenerateResult
  formData: TripForm
  paquete: Paquete
  onPaquete: (paquete: Paquete) => void
  onVerItinerario: () => void
  /** Volver al formulario (y enfocar un campo si se pasa). */
  onEditar: (campo?: CampoForm) => void
  onReintentar: () => void
}

export function PasoVersiones({
  resultado,
  formData,
  paquete,
  onPaquete,
  onVerItinerario,
  onEditar,
  onReintentar,
}: PasoVersionesProps) {
  const [tabla, setTabla] = useState(false)
  // La barra inferior (h-bottombar) está en todos los anchos.
  useToastOffset(72)
  const moneda = resultado.moneda ?? formData.moneda
  const elegido = resultado[paquete]
  const nivel = NIVELES[paquete]
  const noches = contarNoches(formData.fechaInicio, formData.fechaFin)
  const destinoPedido = formData.destinoSorpresa
    ? 'Destino sorpresa'
    : formData.destino
  // Con «Sorpréndeme» el destino lo elige la IA; en demo NUNCA se presenta el
  // ejemplo como si fuera el destino pedido.
  const destinoElegido =
    formData.destinoSorpresa && !resultado.demo
      ? resultado.confort.destino
      : null

  const seleccionarMovil = (p: Paquete) => {
    onPaquete(p)
    const reducido =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(idTarjetaVersion(p))?.scrollIntoView({
      behavior: reducido ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }

  return (
    <div className="mx-auto max-w-content px-4 pt-6 pb-32 md:px-6 lg:px-8 lg:pt-10">
      <Button
        variant="ghost"
        size="sm"
        icon={<ArrowLeft />}
        onClick={() => onEditar()}
        className="-ml-3"
      >
        Editar datos
      </Button>

      <ul
        aria-label="Tu búsqueda (elige un dato para editarlo)"
        className="mt-4 flex flex-wrap gap-2"
      >
        <li>
          <Chip
            size="sm"
            icon={formData.destinoSorpresa ? <Dices /> : <MapPin />}
            aria-label={`Editar destino: ${destinoPedido}`}
            onClick={() => onEditar('destino')}
          >
            <m.span layoutId="trip-destino" className="inline-block">
              {destinoPedido}
            </m.span>
          </Chip>
        </li>
        <li>
          <Chip
            size="sm"
            icon={<CalendarDays />}
            aria-label={`Editar fechas: ${formatRangoFechas(formData.fechaInicio, formData.fechaFin)}`}
            onClick={() => onEditar('fechaInicio')}
          >
            <span className="tnum">
              {formatRangoFechas(formData.fechaInicio, formData.fechaFin)}
            </span>
          </Chip>
        </li>
        <li>
          <Chip
            size="sm"
            icon={<Users />}
            aria-label={`Editar viajeros: ${formatViajeros(formData.personas)}`}
            onClick={() => onEditar('personas')}
          >
            {formatViajeros(formData.personas)}
          </Chip>
        </li>
        <li>
          <Chip
            size="sm"
            icon={<Wallet />}
            aria-label={`Editar presupuesto: ${formatCurrency(formData.presupuesto, formData.moneda)}`}
            onClick={() => onEditar('presupuesto')}
          >
            <span className="tnum">
              {formatCurrency(formData.presupuesto, formData.moneda)}
            </span>
          </Chip>
        </li>
      </ul>

      <p className="mt-8 kicker">
        {resultado.demo ? 'Ejemplo · ' : ''}3 versiones · {formatNoches(noches)}
      </p>
      <h1
        tabIndex={-1}
        className="mt-3 rounded-sm font-display text-h1 text-fg"
      >
        Elige cómo quieres vivirlo
      </h1>
      {destinoElegido ? (
        <p className="mt-3 text-lead text-fg-muted">
          Para tu sorpresa elegimos{' '}
          <span className="font-display text-[20px] text-fg italic">
            {destinoElegido}
          </span>
          .
        </p>
      ) : null}

      {resultado.demo ? (
        <Callout
          tone="warning"
          title="Te mostramos un ejemplo"
          className="mt-6 max-w-prose"
          action={
            <Button variant="link" icon={<RotateCcw />} onClick={onReintentar}>
              Reintentar
            </Button>
          }
        >
          {/* Nunca se nombra el destino del ejemplo (docs/DISENO.md §6.4). */}
          No pudimos trazar tu plan ahora mismo. Estas versiones son un viaje de
          muestra, no{' '}
          {formData.destinoSorpresa
            ? 'un destino elegido para ti'
            : `tu viaje a ${formData.destino}`}
          .
        </Callout>
      ) : null}

      {/* Móvil: nivel sticky bajo el header */}
      <div className="sticky top-14 z-(--z-sticky) -mx-4 mt-6 bg-bg/92 px-4 py-2 md:top-16 md:-mx-6 md:px-6 lg:hidden">
        <PackageSelector
          value={paquete}
          onChange={seleccionarMovil}
          label="Versión"
          fullWidth
        />
      </div>

      <PackageCompare
        basico={resultado.basico}
        confort={resultado.confort}
        premium={resultado.premium}
        selected={paquete}
        moneda={moneda}
        presupuesto={formData.presupuesto}
        onSelect={onPaquete}
        className="mt-2 lg:mt-8"
      />

      {/* Barra inferior: seleccionar ≠ confirmar */}
      <BarraInferior>
        <p aria-live="polite" className="min-w-0 truncate text-body-s">
          <span className="font-semibold text-fg">{nivel.label}</span>
          <span className="text-fg-muted">
            {' · '}
            <span className="tnum">
              {formatCurrency(elegido.presupuestoTotal, moneda)}
            </span>
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            icon={<Table2 />}
            onClick={() => setTabla(true)}
            className="max-sm:w-control-md max-sm:px-0"
            aria-label="Comparar en tabla"
          >
            <span className="max-sm:hidden">Comparar en tabla</span>
          </Button>
          <Button
            size="lg"
            iconEnd={<ArrowRight />}
            onClick={onVerItinerario}
            className="max-sm:h-control-md max-sm:px-[18px] max-sm:text-[15px]"
          >
            Ver itinerario
            <span className="max-sm:hidden"> {nivel.label}</span>
          </Button>
        </div>
      </BarraInferior>

      <Modal
        open={tabla}
        onClose={() => setTabla(false)}
        title="Comparar en tabla"
        description="Precios estimados para todo el grupo, sin vuelo."
        size="lg"
      >
        <TablaComparativa
          basico={resultado.basico}
          confort={resultado.confort}
          premium={resultado.premium}
          moneda={moneda}
          presupuesto={formData.presupuesto}
        />
      </Modal>
    </div>
  )
}
