'use client'

import type { ReactNode } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import {
  CalendarDays,
  Dices,
  Gauge,
  MapPin,
  Star,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Card,
  CardFila,
  CardFilas,
  CardFranja,
  CardPerforado,
} from '@/components/ui/Card'
import { DUR } from '@/components/ui/motion'
import {
  contarNoches,
  formatNoches,
  formatRangoFechas,
  formatViajeros,
} from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import {
  etiquetaDestino,
  presupuestoTexto,
  type TripFormDraft,
} from './borrador'
import { NIVELES, etiquetaTipo, iconoTipo } from './catalogo'

/**
 * Ficha «Tu ruta» (docs/DISENO.md §6.2): boleto que se rellena en vivo con lo
 * que el usuario va escribiendo. Cada valor entra con un fundido de 140 ms.
 */
export function FichaRuta({
  borrador,
  className,
}: {
  borrador: TripFormDraft
  className?: string
}) {
  const destino = etiquetaDestino(borrador)
  const noches =
    borrador.fechaInicio && borrador.fechaFin
      ? contarNoches(borrador.fechaInicio, borrador.fechaFin)
      : null
  const nivel = NIVELES[borrador.paquete]

  return (
    <Card variant="boleto" className={className}>
      <CardFranja extra={noches !== null ? formatNoches(noches) : undefined}>
        Wayio · Tu ruta
      </CardFranja>
      <CardFilas>
        <CardFila
          etiqueta="Destino"
          icon={borrador.destinoSorpresa ? <Dices /> : <MapPin />}
        >
          <Valor texto={destino} />
        </CardFila>
        <CardFila etiqueta="Fechas" icon={<CalendarDays />}>
          <Valor
            texto={formatRangoFechas(borrador.fechaInicio, borrador.fechaFin)}
            className="tnum"
          />
        </CardFila>
        <CardFila etiqueta="Viajeros" icon={<Users />}>
          <Valor texto={formatViajeros(borrador.personas)} className="tnum" />
        </CardFila>
        <CardFila etiqueta="Presupuesto" icon={<Wallet />}>
          <Valor texto={presupuestoTexto(borrador)} className="tnum" />
        </CardFila>
        <CardFila
          etiqueta="Estilo"
          icon={iconoTipo(borrador.tipo) ?? <Gauge />}
        >
          <Valor
            texto={
              borrador.tipo === 'crucero' && borrador.zona.trim()
                ? `Crucero · ${borrador.zona.trim()}`
                : etiquetaTipo(borrador.tipo)
            }
          />
        </CardFila>
        <CardFila etiqueta="Nivel" icon={<Star />}>
          <Valor texto={`${nivel.label} · ${nivel.estrellas}★`} />
        </CardFila>
      </CardFilas>
      <CardPerforado />
      <p className="px-5 pt-1 pb-5 text-caption text-fg-muted">
        Trazamos 3 versiones · tarda entre 20 y 60 s
      </p>
    </Card>
  )
}

function Valor({
  texto,
  className,
}: {
  texto: string
  className?: string
}): ReactNode {
  const vacio = !texto.trim()
  const mostrado = vacio ? 'Por definir' : texto
  return (
    <span className="relative inline-flex min-w-0">
      <AnimatePresence initial={false} mode="popLayout">
        <m.span
          key={mostrado}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR.fast }}
          className={cn('truncate', vacio && 'text-fg-subtle', className)}
        >
          {mostrado}
        </m.span>
      </AnimatePresence>
    </span>
  )
}
