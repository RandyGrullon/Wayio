'use client'

import { useEffect, useState } from 'react'
import { Pencil, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Card, CardKicker } from '@/components/ui/Card'
import { SkeletonVersion } from '@/components/ui/Skeleton'
import type { ProgressEvent } from '@/lib/ai/generateTrips'
import type { TripForm } from '@/lib/validations/tripForm'
import { formatRangoFechas } from '@/lib/utils/formatters'
import { RutaDeFases } from './RutaDeFases'

/**
 * Paso «trazado» (docs/DISENO.md §6.3): RutaDeFases con las fases reales del
 * SSE, el texto de la fase en una región viva, cronómetro, aviso a los 45 s,
 * esqueleto de las 3 versiones y un consejo por fase (sin temporizador).
 */

export interface EstadoGeneracion {
  estado: 'activo' | 'error' | 'listo'
  /** Índice del sello en curso (0..3). */
  actual: number
  fase: ProgressEvent['fase'] | null
  label: string
  /** Date.now() al empezar (para el cronómetro). */
  inicio: number
  /** Caché o demo: la ruta se traza de golpe. */
  rapido: boolean
  demo: boolean
  error?: string
}

const CONSEJOS: readonly (readonly string[])[] = [
  [
    'Si viajas en temporada alta, reserva el hospedaje con tiempo: es lo primero que se agota.',
    'Revisa que tu pasaporte no venza en los próximos seis meses: muchos países lo exigen.',
    'Mira si tu destino pide visa o formulario de entrada antes de comprar el vuelo.',
  ],
  [
    'Agrupamos los lugares por zona para que no pierdas horas en traslados.',
    'Después podrás cambiar cualquier actividad a mano o pedírselo a la IA con «Ajustar con IA».',
    'Las tres versiones comparten la ruta; cambian el hospedaje, los restaurantes y las experiencias.',
  ],
  [
    'Cada lugar llega con su punto en el mapa y su botón «Cómo llegar».',
    'Guarda el viaje para tenerlo disponible sin conexión cuando estés allá.',
  ],
  [
    'Compara las versiones con calma: el encaje con tu presupuesto te dice cuál cabe mejor.',
  ],
]

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0')
}

export interface PasoTrazadoProps {
  formData: TripForm
  gen: EstadoGeneracion
  onReintentar: () => void
  onEditar: () => void
}

export function PasoTrazado({
  formData,
  gen,
  onReintentar,
  onEditar,
}: PasoTrazadoProps) {
  const destino = formData.destinoSorpresa
    ? 'Destino sorpresa'
    : formData.destino
  const rango = formatRangoFechas(formData.fechaInicio, formData.fechaFin)
  const error = gen.estado === 'error'

  return (
    <div className="reticula min-h-dvh">
      <div className="mx-auto max-w-[560px] px-4 pt-12 pb-16 sm:pt-16">
        <h1 tabIndex={-1} className="kicker rounded-sm">
          Trazando tu viaje · {destino}
          {rango ? ` · ${rango}` : ''}
        </h1>

        <RutaDeFases
          actual={Math.max(0, gen.actual)}
          completo={gen.estado === 'listo'}
          error={error}
          rapido={gen.rapido}
          origenLayoutId="ruta-origen"
          className="mt-10"
        />

        <div aria-live="polite" className="mt-10">
          <p className="font-display text-h2 text-fg">
            {error ? 'No pudimos trazar tu viaje' : gen.label}
          </p>
        </div>

        {error ? (
          <Callout
            tone="danger"
            title="Algo falló mientras lo trazábamos"
            className="mt-6"
            action={
              <>
                <Button icon={<RotateCcw />} onClick={onReintentar} size="sm">
                  Reintentar
                </Button>
                <Button
                  variant="outline"
                  icon={<Pencil />}
                  onClick={onEditar}
                  size="sm"
                >
                  Editar datos
                </Button>
              </>
            }
          >
            {gen.error ?? 'Inténtalo de nuevo en un momento.'}
          </Callout>
        ) : (
          <Cronometro
            key={gen.inicio}
            inicio={gen.inicio}
            parado={gen.estado === 'listo'}
          />
        )}

        {gen.demo && !error ? (
          <Callout tone="warning" className="mt-6">
            Te mostramos un ejemplo: no pudimos trazar tu plan ahora mismo.
          </Callout>
        ) : null}

        {!error ? (
          <Consejo grupo={Math.min(3, Math.max(0, gen.actual))} />
        ) : null}
      </div>

      {!error ? (
        <div
          aria-hidden="true"
          className="mx-auto grid max-w-[960px] gap-4 px-4 pb-24 sm:grid-cols-3"
        >
          <SkeletonVersion />
          <SkeletonVersion className="max-sm:hidden" />
          <SkeletonVersion className="max-sm:hidden" />
        </div>
      ) : null}
    </div>
  )
}

/** «Suele tardar…» + cronómetro mm:ss y aviso a los 45 s. */
function Cronometro({ inicio, parado }: { inicio: number; parado: boolean }) {
  const [segundos, setSegundos] = useState(0)
  useEffect(() => {
    if (parado) return
    const tick = () =>
      setSegundos(Math.max(0, Math.floor((Date.now() - inicio) / 1000)))
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [inicio, parado])

  return (
    <div className="mt-3">
      <p className="flex flex-wrap items-baseline gap-x-3 text-caption text-fg-muted">
        Suele tardar entre 20 y 60 segundos
        <span
          role="timer"
          aria-label={`${segundos} segundos`}
          className="font-mono text-data text-fg tnum"
        >
          {dosDigitos(Math.floor(segundos / 60))}:{dosDigitos(segundos % 60)}
        </span>
      </p>
      <p aria-live="polite" className="mt-2 text-body-s text-warning-fg">
        {segundos >= 45 && !parado
          ? 'Está tardando más de lo normal; seguimos trabajando.'
          : ''}
      </p>
    </div>
  )
}

/** Un consejo por fase; cambia con la fase real o con «Otro consejo». */
function Consejo({ grupo }: { grupo: number }) {
  const lista = CONSEJOS[grupo] ?? CONSEJOS[0] ?? []
  const [indice, setIndice] = useState(0)
  const [grupoPrevio, setGrupoPrevio] = useState(grupo)
  if (grupo !== grupoPrevio) {
    setGrupoPrevio(grupo)
    setIndice(0)
  }
  const texto = lista[indice % Math.max(1, lista.length)] ?? ''
  return (
    <Card variant="nota" className="mt-10">
      <CardKicker>Mientras tanto</CardKicker>
      <p className="mt-2 text-body-s">{texto}</p>
      {lista.length > 1 ? (
        <Button
          variant="link"
          className="mt-3 text-[15px]"
          onClick={() => setIndice((i) => i + 1)}
        >
          Otro consejo
        </Button>
      ) : null}
    </Card>
  )
}
