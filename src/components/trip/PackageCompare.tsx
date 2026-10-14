'use client'

import { useId } from 'react'
import type { KeyboardEvent } from 'react'
import { m } from 'framer-motion'
import { AlertCircle, AlertTriangle, CheckCircle2, Star } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { DUR, EASE } from '@/components/ui/motion'
import { Sello } from '@/components/brand/Sello'
import { NIVELES, ORDEN_PAQUETES } from '@/components/planner/catalogo'
import {
  diferenciasDe,
  encajeDe,
  filasDe,
  referenciaDe,
  type Encaje,
  type FilasVersion,
} from '@/components/planner/versiones'
import type { Trip } from '@/types/trip'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'

/**
 * Versiones del viaje (docs/DISENO.md §6.4): tres tarjetas en un radiogroup
 * con filas alineadas (subgrid desde lg, carrusel snap-x por debajo). Cada
 * tarjeta muestra el encaje con el presupuesto (texto + icono + barra; nunca
 * solo color), las filas comparables («Igual» si no cambia respecto a
 * Básico) y «Lo que la hace distinta». Seleccionar NO navega.
 *
 * Sin iconos ni textos de avión: el precio es «sin vuelo».
 */

type Paquete = Trip['paquete']

export interface PackageCompareProps {
  basico: Trip
  confort: Trip
  premium: Trip
  selected: Paquete
  /** Moneda del viaje (la de GenerateResult). */
  moneda?: string
  onSelect: (paquete: Paquete) => void
  /** Presupuesto del formulario para el encaje (en la misma moneda). */
  presupuesto?: number | null
  className?: string
}

export const idTarjetaVersion = (tier: Paquete) => `version-${tier}`

const entrada = {
  oculto: { opacity: 0, y: 24, rotate: -1.5 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: { duration: DUR.slow, ease: EASE.papel, delay: 0.08 * i },
  }),
}

const ETIQUETAS_FILAS: readonly [keyof FilasVersion, string][] = [
  ['dias', 'Días'],
  ['actividades', 'Actividades'],
  ['hospedaje', 'Hospedaje'],
  ['transporte', 'Transporte'],
  ['ritmo', 'Ritmo'],
]

function valorFila(f: FilasVersion, clave: keyof FilasVersion): string {
  switch (clave) {
    case 'actividades':
      return `${f.actividades} · ${f.dePago} de pago`
    case 'ritmo':
      return `${f.ritmo} act./día`
    case 'dias':
      return String(f.dias)
    case 'dePago':
      return String(f.dePago)
    default:
      return f[clave]
  }
}

export function PackageCompare({
  basico,
  confort,
  premium,
  selected,
  moneda = 'USD',
  onSelect,
  presupuesto,
  className,
}: PackageCompareProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const trips: Record<Paquete, Trip> = { basico, confort, premium }
  const filas: Record<Paquete, FilasVersion> = {
    basico: filasDe(basico, 'basico'),
    confort: filasDe(confort, 'confort'),
    premium: filasDe(premium, 'premium'),
  }

  const mover = (desde: Paquete, delta: number) => {
    const i = ORDEN_PAQUETES.indexOf(desde)
    const n = ORDEN_PAQUETES.length
    const destino = ORDEN_PAQUETES[(((i + delta) % n) + n) % n]
    if (!destino) return
    onSelect(destino)
    document.getElementById(idTarjetaVersion(destino))?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, tier: Paquete) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      mover(tier, 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      mover(tier, -1)
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      onSelect(tier)
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Versiones del viaje"
      className={cn(
        '-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pt-6 pb-4 md:-mx-6 md:px-6',
        'lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-x-6 lg:overflow-visible lg:px-0 lg:pb-0',
        className
      )}
    >
      {ORDEN_PAQUETES.map((tier, i) => {
        const trip = trips[tier]
        const meta = NIVELES[tier]
        const f = filas[tier]
        const elegida = selected === tier
        const encaje = encajeDe(trip.presupuestoTotal, presupuesto)
        const rasgos = diferenciasDe(trip, tier, trips[referenciaDe(tier)])
        const kickerId = `${uid}-${tier}-kicker`
        const precioId = `${uid}-${tier}-precio`
        const encajeId = `${uid}-${tier}-encaje`
        return (
          <m.div
            key={tier}
            id={idTarjetaVersion(tier)}
            layoutId={idTarjetaVersion(tier)}
            role="radio"
            aria-checked={elegida}
            aria-labelledby={`${kickerId} ${precioId}`}
            aria-describedby={encaje ? encajeId : undefined}
            tabIndex={elegida ? 0 : -1}
            onClick={() => onSelect(tier)}
            onKeyDown={(e) => onKeyDown(e, tier)}
            custom={i}
            variants={entrada}
            initial="oculto"
            animate="visible"
            className={cn(
              'relative flex w-[88%] shrink-0 cursor-pointer snap-center flex-col gap-5 rounded-card bg-surface p-5 text-left sm:w-[60%] md:w-[46%] md:p-6',
              'lg:row-span-7 lg:grid lg:w-auto lg:grid-rows-subgrid lg:gap-y-5',
              'transition-[border-color,box-shadow] duration-(--dur-base) ease-papel',
              elegida
                ? 'border-2 border-fg p-[19px] shadow-elev md:p-[23px]'
                : 'border border-border-strong hover:shadow-elev'
            )}
          >
            {elegida ? (
              <Sello
                forma="rect"
                tono="laton"
                animar
                className="absolute -top-4 right-5 bg-surface"
              >
                Elegida
              </Sello>
            ) : null}

            {/* 1 · Versión */}
            <div className="flex min-h-6 flex-wrap items-center justify-between gap-2">
              <p id={kickerId} className={cn('kicker', meta.kicker)}>
                {meta.label}
              </p>
              {tier === 'confort' ? (
                <Badge variant="laton">Equilibrio ideal</Badge>
              ) : null}
            </div>

            {/* 2 · Hoteles */}
            <p className="flex items-center gap-2 text-body-s text-fg-muted">
              <span aria-hidden="true" className="flex text-brass">
                {Array.from({ length: meta.estrellas }, (_, k) => (
                  <Star
                    key={k}
                    strokeWidth={1.75}
                    className="size-4 fill-current"
                  />
                ))}
              </span>
              {meta.hoteles}
            </p>

            {/* 3 · Precio */}
            <div>
              <p id={precioId} className="text-num-xl text-fg tnum">
                {formatCurrency(trip.presupuestoTotal, moneda)}
              </p>
              <p className="mt-1 text-caption text-fg-muted tnum">
                {formatCurrency(trip.presupuestoPorPersona, moneda)} por persona
                · sin vuelo
              </p>
            </div>

            {/* 4 · Encaje con el presupuesto */}
            <EncajePresupuesto encaje={encaje} id={encajeId} />

            {/* 5 · Filas alineadas */}
            <dl className="text-body-s">
              {ETIQUETAS_FILAS.map(([clave, etiqueta]) => {
                const valor = valorFila(f, clave)
                const igual =
                  tier !== 'basico' && valor === valorFila(filas.basico, clave)
                return (
                  <div
                    key={clave}
                    className="flex items-baseline justify-between gap-4 border-t border-border py-2"
                  >
                    <dt className="shrink-0 text-fg-muted">{etiqueta}</dt>
                    <dd
                      className={cn(
                        'min-w-0 truncate text-right tnum',
                        igual ? 'text-fg-subtle' : 'text-fg'
                      )}
                      title={igual ? valor : undefined}
                    >
                      {igual ? 'Igual' : valor}
                    </dd>
                  </div>
                )
              })}
            </dl>

            {/* 6 · Lo que la hace distinta */}
            <div>
              <p className="kicker">Lo que la hace distinta</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-body-s text-fg">
                {rasgos.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-rule"
                    />
                    <span className="min-w-0">{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 7 · Indicador */}
            <div className="mt-auto flex items-center gap-2.5 border-t border-border pt-4 text-[15px] font-semibold">
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full',
                  elegida ? 'bg-fg' : 'border-2 border-border-strong'
                )}
              >
                {elegida ? (
                  <span className="size-2 rounded-full bg-fg-inverse" />
                ) : null}
              </span>
              <span className={elegida ? 'text-fg' : 'text-fg-muted'}>
                {elegida ? 'Seleccionada' : 'Seleccionar'}
              </span>
            </div>
          </m.div>
        )
      })}
    </div>
  )
}

const TONO_ENCAJE = {
  success: {
    texto: 'text-success-fg',
    barra: 'bg-success',
    Icono: CheckCircle2,
  },
  warning: {
    texto: 'text-warning-fg',
    barra: 'bg-warning',
    Icono: AlertTriangle,
  },
  danger: { texto: 'text-danger-fg', barra: 'bg-danger', Icono: AlertCircle },
} as const

export function EncajePresupuesto({
  encaje,
  id,
  className,
}: {
  encaje: Encaje | null
  id?: string
  className?: string
}) {
  if (!encaje) {
    return (
      <p className={cn('text-caption text-fg-muted', className)}>
        Sin presupuesto para comparar.
      </p>
    )
  }
  const { texto, barra, Icono } = TONO_ENCAJE[encaje.tono]
  return (
    <div className={className}>
      <p
        id={id}
        className={cn(
          'flex items-start gap-1.5 text-body-s font-medium',
          texto
        )}
      >
        <Icono
          aria-hidden="true"
          strokeWidth={1.75}
          className="mt-0.5 size-4 shrink-0"
        />
        {encaje.texto}
      </p>
      <div
        aria-hidden="true"
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className={cn('h-full rounded-full', barra)}
          style={{ width: `${Math.min(100, Math.max(4, encaje.pct))}%` }}
        />
      </div>
    </div>
  )
}

/** Tabla de 3 columnas para el modal «Comparar en tabla». */
export function TablaComparativa({
  basico,
  confort,
  premium,
  moneda = 'USD',
  presupuesto,
}: Omit<PackageCompareProps, 'selected' | 'onSelect' | 'className'>) {
  const trips: Record<Paquete, Trip> = { basico, confort, premium }
  const filas: Record<Paquete, FilasVersion> = {
    basico: filasDe(basico, 'basico'),
    confort: filasDe(confort, 'confort'),
    premium: filasDe(premium, 'premium'),
  }
  const lineas: readonly [string, (t: Paquete) => string][] = [
    ['Precio total', (t) => formatCurrency(trips[t].presupuestoTotal, moneda)],
    [
      'Por persona',
      (t) => formatCurrency(trips[t].presupuestoPorPersona, moneda),
    ],
    [
      'Encaje',
      (t) => encajeDe(trips[t].presupuestoTotal, presupuesto)?.texto ?? '—',
    ],
    ['Hospedaje', (t) => filas[t].hospedaje],
    ['Días', (t) => String(filas[t].dias)],
    ['Actividades', (t) => String(filas[t].actividades)],
    ['De pago', (t) => String(filas[t].dePago)],
    ['Transporte', (t) => filas[t].transporte],
    ['Ritmo', (t) => `${filas[t].ritmo} act./día`],
  ]
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[520px] border-collapse text-body-s">
        <caption className="sr-only">
          Comparación de las versiones Básico, Confort y Premium (precios sin
          vuelo)
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-[28%] py-2 pr-3 text-left">
              <span className="sr-only">Concepto</span>
            </th>
            {ORDEN_PAQUETES.map((t) => (
              <th
                key={t}
                scope="col"
                className={cn('px-3 py-2 text-left kicker', NIVELES[t].kicker)}
              >
                {NIVELES[t].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lineas.map(([etiqueta, valor]) => (
            <tr key={etiqueta} className="border-t border-border">
              <th
                scope="row"
                className="py-2.5 pr-3 text-left font-medium text-fg-muted"
              >
                {etiqueta}
              </th>
              {ORDEN_PAQUETES.map((t) => (
                <td key={t} className="px-3 py-2.5 align-top text-fg tnum">
                  {valor(t)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
