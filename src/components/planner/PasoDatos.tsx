'use client'

import { useState, useSyncExternalStore } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { ArrowRight, ChevronDown, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast, useToastOffset } from '@/components/ui/Toast'
import { TripForm, enfocarCampo } from '@/components/trip/TripForm'
import { RecreateTrip } from '@/components/trip/RecreateTrip'
import type { PlaceFromVideo } from '@/lib/ai/analyzeVideo'
import type { InterpretResult } from '@/lib/validations/interpret'
import type { TripForm as TripFormData } from '@/lib/validations/tripForm'
import { track } from '@/lib/analytics/events'
import { contarNoches, formatNoches } from '@/lib/utils/formatters'
import {
  etiquetaDestino,
  type ErroresForm,
  type Estacion,
  type TripFormDraft,
} from './borrador'
import { BarraInferior } from './BarraInferior'
import { FichaRuta } from './FichaRuta'
import { LoQueEntendimos } from './LoQueEntendimos'
import { useInterpretacion } from './useInterpretacion'

/** Faltantes de /api/interpret → estación del formulario que los pide. */
const ESTACION_FALTANTE: Record<string, Estacion> = {
  destino: 'destino',
  origen: 'destino',
  fechas: 'fechas',
  personas: 'viajeros',
  presupuesto: 'viajeros',
}

export const ID_FORMULARIO = 'form-viaje'

/** Desde lg el CTA «Trazar mi viaje» del formulario está visible. */
const ESCRITORIO = '(min-width: 1024px)'

function suscribirEscritorio(cambio: () => void): () => void {
  const mq = window.matchMedia(ESCRITORIO)
  mq.addEventListener('change', cambio)
  return () => mq.removeEventListener('change', cambio)
}

export interface PasoDatosProps {
  borrador: TripFormDraft
  setBorrador: Dispatch<SetStateAction<TripFormDraft>>
  interpretacion: InterpretResult | null
  onInterpretacion: (resultado: InterpretResult) => void
  /** Errores del servidor (400) asignados a cada campo. */
  errores?: ErroresForm | undefined
  onSubmit: (data: TripFormData) => void
}

/**
 * Paso «datos» (docs/DISENO.md §6.2): ficha «Tu ruta» sticky a la izquierda
 * (acordeón arriba en móvil), «Lo que entendimos» y el formulario por
 * estaciones a la derecha. En móvil, barra fija inferior con «Trazar».
 */
export function PasoDatos({
  borrador,
  setBorrador,
  interpretacion,
  onInterpretacion,
  errores,
  onSubmit,
}: PasoDatosProps) {
  const { success } = useToast()
  const [videoAbierto, setVideoAbierto] = useState(false)
  // La barra fija con «Trazar» (h-bottombar) solo existe por debajo de lg.
  useToastOffset(72, '(max-width: 1023px)')
  // El relevo CTA → aro de origen (layoutId) solo cuando el CTA se ve: por
  // debajo de lg está oculto (display:none, caja 0×0) y el aro de RutaDeFases
  // «volaría» desde la esquina superior izquierda.
  const escritorio = useSyncExternalStore(
    suscribirEscritorio,
    () => window.matchMedia(ESCRITORIO).matches,
    () => false
  )
  const { estado, entender, alSalir } = useInterpretacion({
    texto: borrador.descripcion,
    inicial: interpretacion,
    onResultado: onInterpretacion,
  })

  const faltantes: Estacion[] =
    estado.tipo === 'listo'
      ? Array.from(
          new Set(
            estado.resultado.faltantes.flatMap((f) => {
              const e = ESTACION_FALTANTE[f]
              return e ? [e] : []
            })
          )
        )
      : []

  const aplicar = (nuevo: TripFormDraft, n: number) => {
    setBorrador(nuevo)
    success(
      n === 1
        ? 'Aplicamos 1 dato al formulario'
        : `Aplicamos ${n} datos al formulario`
    )
    track('interpretacion_usada', {
      fuente: 'texto',
      exito: true,
      camposDetectados: n,
    })
  }

  const confirmarVideo = (destino: string, lugares: PlaceFromVideo[]) => {
    setVideoAbierto(false)
    const nombres = lugares.map((l) => l.lugar.trim()).filter(Boolean)
    setBorrador((b) => ({
      ...b,
      ...(destino.trim()
        ? { destino: destino.trim(), destinoSorpresa: false }
        : {}),
      lugaresDeseados: Array.from(
        new Set([...b.lugaresDeseados, ...nombres])
      ).slice(0, 30),
    }))
    if (nombres.length > 0) {
      success(
        nombres.length === 1
          ? 'Añadimos 1 lugar a tu viaje'
          : `Añadimos ${nombres.length} lugares a tu viaje`
      )
    }
    window.setTimeout(() => enfocarCampo('destino'), 80)
  }

  const lqe = (
    <LoQueEntendimos
      estado={estado}
      borrador={borrador}
      onAplicar={aplicar}
      onReintentar={entender}
    />
  )

  const destino = etiquetaDestino(borrador)
  const noches =
    borrador.fechaInicio && borrador.fechaFin
      ? formatNoches(contarNoches(borrador.fechaInicio, borrador.fechaFin))
      : null

  return (
    <div className="mx-auto max-w-content px-4 pt-8 pb-32 md:px-6 lg:px-8 lg:pt-14 lg:pb-24">
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="min-w-0 lg:col-span-7">
          {/* Móvil: la ficha como acordeón arriba */}
          <details className="group mb-8 rounded-card border border-border bg-surface lg:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-card px-4 py-3 text-body-s [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 truncate">
                <span className="font-semibold text-fg">Tu ruta</span>
                <span className="text-fg-muted">
                  {' · '}
                  {destino || 'Por definir'}
                  {noches ? ` · ${noches}` : ''}
                  {' · '}
                  <span className="tnum">{borrador.personas}</span>
                  <span className="sr-only"> viajeros</span>
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-[18px] shrink-0 text-fg-subtle transition-transform duration-(--dur-medium) group-open:rotate-180"
              />
            </summary>
            <div className="px-3 pb-3">
              <FichaRuta borrador={borrador} className="shadow-none" />
            </div>
          </details>

          <h1
            tabIndex={-1}
            className="rounded-sm font-display text-display-l text-fg"
          >
            Diseña tu viaje
          </h1>
          <p className="mt-4 max-w-[60ch] text-lead text-fg-muted">
            Cuéntalo a tu manera o ve campo por campo. Con lo que nos des,
            trazamos tres versiones para que elijas.
          </p>

          <div className="mt-10">
            <TripForm
              id={ID_FORMULARIO}
              value={borrador}
              onChange={setBorrador}
              onSubmit={onSubmit}
              errores={errores}
              faltantes={faltantes}
              onEntender={
                estado.tipo === 'no-disponible' ? undefined : entender
              }
              entendiendo={estado.tipo === 'cargando'}
              onDescripcionBlur={alSalir}
              onDesdeVideo={() => setVideoAbierto(true)}
              extraDescripcion={<div className="lg:hidden">{lqe}</div>}
              envioSoloEscritorio
              ctaLayoutId={escritorio ? 'ruta-origen' : undefined}
            />
          </div>
        </div>

        {/* Escritorio: ficha sticky a la izquierda */}
        <aside
          aria-label="Resumen de tu ruta"
          className="hidden lg:order-first lg:col-span-5 lg:block"
        >
          <div className="sticky top-24 flex flex-col gap-6">
            <FichaRuta borrador={borrador} />
            {lqe}
          </div>
        </aside>
      </div>

      {/* Móvil: barra fija con el resumen y «Trazar» */}
      <BarraInferior className="lg:hidden">
        <p className="min-w-0 truncate text-body-s text-fg-muted">
          <span className="font-semibold text-fg">{destino || 'Tu viaje'}</span>
          {noches ? ` · ${noches}` : ''}
          {' · '}
          <Users
            aria-hidden="true"
            strokeWidth={1.75}
            className="inline size-4 align-[-3px]"
          />{' '}
          <span className="tnum">{borrador.personas}</span>
          <span className="sr-only"> viajeros</span>
        </p>
        <Button
          type="submit"
          form={ID_FORMULARIO}
          size="md"
          iconEnd={<ArrowRight />}
        >
          Trazar
        </Button>
      </BarraInferior>

      <RecreateTrip
        open={videoAbierto}
        onClose={() => setVideoAbierto(false)}
        onConfirm={confirmarVideo}
        loginRedirect="/planificar?paso=datos"
        onEscribirDestino={() => {
          setVideoAbierto(false)
          window.setTimeout(() => enfocarCampo('destino'), 80)
        }}
      />
    </div>
  )
}
