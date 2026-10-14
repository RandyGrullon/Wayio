'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  CalendarDays,
  Dices,
  Gauge,
  MapPin,
  PlaneTakeoff,
  Ship,
  Users,
  Wallet,
} from 'lucide-react'
import { Button, Spinner } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import type { InterpretResult } from '@/lib/validations/interpret'
import {
  formatCurrency,
  formatFecha,
  formatRangoFechas,
  formatViajeros,
} from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { borradorVacio, type TripFormDraft } from './borrador'
import { NIVELES, etiquetaTipo, iconoTipo } from './catalogo'
import type { EstadoInterpretacion } from './useInterpretacion'

/**
 * «Lo que entendimos» (docs/DISENO.md §6.2): chips con lo que la IA dedujo de
 * la descripción. Cada chip se puede desmarcar; «Aplicar al formulario»
 * rellena solo los campos vacíos y, si alguno ya lo había puesto el usuario,
 * ofrece reemplazarlo también. Sin backend (503) no se muestra.
 */

interface Detectado {
  clave: string
  etiqueta: string
  icono: ReactNode
  /** El campo del formulario está vacío (o con su valor por defecto). */
  vacio: (b: TripFormDraft) => boolean
  /** El formulario ya tiene exactamente este valor. */
  igual: (b: TripFormDraft) => boolean
  aplicar: (b: TripFormDraft) => TripFormDraft
  /** Nombre del campo para el aviso de reemplazo. */
  campo: string
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const norm = (s: string) =>
  s.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '')
const POR_DEFECTO = borradorVacio()

function detectados(r: InterpretResult): Detectado[] {
  const c = r.campos
  const lista: Detectado[] = []

  if (c.destinoSorpresa) {
    lista.push({
      clave: 'destino',
      campo: 'Destino',
      etiqueta: 'Destino sorpresa',
      icono: <Dices />,
      vacio: (b) => !b.destinoSorpresa && !b.destino.trim(),
      igual: (b) => b.destinoSorpresa,
      aplicar: (b) => ({ ...b, destinoSorpresa: true }),
    })
  } else if (c.destino?.trim()) {
    const destino = c.destino.trim()
    lista.push({
      clave: 'destino',
      campo: 'Destino',
      etiqueta: destino,
      icono: <MapPin />,
      vacio: (b) => !b.destinoSorpresa && !b.destino.trim(),
      igual: (b) => !b.destinoSorpresa && norm(b.destino) === norm(destino),
      aplicar: (b) => ({ ...b, destino, destinoSorpresa: false }),
    })
  }

  if (c.origen?.trim()) {
    const origen = c.origen.trim()
    lista.push({
      clave: 'origen',
      campo: 'Ciudad de origen',
      etiqueta: `Desde ${origen}`,
      icono: <PlaneTakeoff />,
      vacio: (b) => !b.origen.trim(),
      igual: (b) => norm(b.origen) === norm(origen),
      aplicar: (b) => ({ ...b, origen }),
    })
  }

  const ini = c.fechaInicio && FECHA.test(c.fechaInicio) ? c.fechaInicio : ''
  const fin =
    c.fechaFin && FECHA.test(c.fechaFin) && (!ini || c.fechaFin >= ini)
      ? c.fechaFin
      : ''
  if (ini) {
    lista.push({
      clave: 'fechas',
      campo: 'Fechas',
      etiqueta: fin
        ? formatRangoFechas(ini, fin)
        : `Salida ${formatFecha(ini, { diaSemana: false })}`,
      icono: <CalendarDays />,
      vacio: (b) => !b.fechaInicio && !b.fechaFin,
      igual: (b) => b.fechaInicio === ini && (!fin || b.fechaFin === fin),
      aplicar: (b) => ({
        ...b,
        fechaInicio: ini,
        fechaFin: fin || (b.fechaFin >= ini ? b.fechaFin : ''),
      }),
    })
  }

  if (c.personas) {
    const personas = c.personas
    lista.push({
      clave: 'personas',
      campo: 'Viajeros',
      etiqueta: formatViajeros(personas),
      icono: <Users />,
      vacio: (b) => b.personas === POR_DEFECTO.personas,
      igual: (b) => b.personas === personas,
      aplicar: (b) => ({ ...b, personas }),
    })
  }

  if (c.presupuesto && c.presupuesto > 0) {
    const presupuesto = String(Math.round(c.presupuesto))
    const moneda = c.moneda
    lista.push({
      clave: 'presupuesto',
      campo: 'Presupuesto',
      etiqueta: formatCurrency(c.presupuesto, moneda ?? 'USD'),
      icono: <Wallet />,
      vacio: (b) => !b.presupuesto.trim(),
      igual: (b) =>
        b.presupuesto === presupuesto && (!moneda || b.moneda === moneda),
      aplicar: (b) => ({ ...b, presupuesto, ...(moneda ? { moneda } : {}) }),
    })
  }

  if (c.tipo) {
    const tipo = c.tipo
    lista.push({
      clave: 'tipo',
      campo: 'Estilo',
      etiqueta: etiquetaTipo(tipo),
      icono: iconoTipo(tipo),
      vacio: (b) => b.tipo === '',
      igual: (b) => b.tipo === tipo,
      aplicar: (b) => ({ ...b, tipo }),
    })
  }

  if (c.zona?.trim()) {
    const zona = c.zona.trim()
    lista.push({
      clave: 'zona',
      campo: 'Zona del crucero',
      etiqueta: `Zona: ${zona}`,
      icono: <Ship />,
      vacio: (b) => !b.zona.trim(),
      igual: (b) => norm(b.zona) === norm(zona),
      aplicar: (b) => ({ ...b, zona }),
    })
  }

  if (c.paquete) {
    const paquete = c.paquete
    lista.push({
      clave: 'paquete',
      campo: 'Nivel',
      etiqueta: `${NIVELES[paquete].label} ${NIVELES[paquete].estrellas}★`,
      icono: <Gauge />,
      vacio: (b) => b.paquete === POR_DEFECTO.paquete,
      igual: (b) => b.paquete === paquete,
      aplicar: (b) => ({ ...b, paquete }),
    })
  }

  for (const p of c.preferencias ?? []) {
    const pref = p.trim()
    if (!pref) continue
    lista.push({
      clave: `pref:${norm(pref)}`,
      campo: 'Preferencias',
      etiqueta: pref,
      icono: null,
      vacio: () => true,
      igual: (b) => b.preferencias.some((x) => norm(x) === norm(pref)),
      aplicar: (b) => ({ ...b, preferencias: [...b.preferencias, pref] }),
    })
  }

  for (const l of c.lugaresDeseados ?? []) {
    const lugar = l.trim()
    if (!lugar) continue
    lista.push({
      clave: `lugar:${norm(lugar)}`,
      campo: 'Lugares',
      etiqueta: lugar,
      icono: <MapPin />,
      vacio: () => true,
      igual: (b) => b.lugaresDeseados.some((x) => norm(x) === norm(lugar)),
      aplicar: (b) => ({
        ...b,
        lugaresDeseados: [...b.lugaresDeseados, lugar],
      }),
    })
  }

  // Claves únicas (la IA puede repetir una preferencia).
  return lista.filter(
    (d, i) => lista.findIndex((x) => x.clave === d.clave) === i
  )
}

export interface LoQueEntendimosProps {
  estado: EstadoInterpretacion
  borrador: TripFormDraft
  /** Devuelve el borrador con lo aplicado y cuántos datos se rellenaron. */
  onAplicar: (nuevo: TripFormDraft, aplicados: number) => void
  onReintentar: () => void
  className?: string
}

export function LoQueEntendimos({
  estado,
  borrador,
  onAplicar,
  onReintentar,
  className,
}: LoQueEntendimosProps) {
  const resultado =
    estado.tipo === 'listo'
      ? estado.resultado
      : estado.tipo === 'cargando'
        ? estado.previo
        : null

  // Selección: todos los chips marcados al llegar un resultado nuevo.
  const [base, setBase] = useState(resultado)
  const [desmarcados, setDesmarcados] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  if (resultado !== base) {
    setBase(resultado)
    setDesmarcados(new Set())
  }

  if (estado.tipo === 'inactivo' || estado.tipo === 'no-disponible') {
    return null
  }

  const lista = resultado ? detectados(resultado) : []
  const marcados = lista.filter((d) => !desmarcados.has(d.clave))
  const porAplicar = marcados.filter(
    (d) => !d.igual(borrador) && d.vacio(borrador)
  )
  const conflictos = marcados.filter(
    (d) => !d.igual(borrador) && !d.vacio(borrador)
  )
  const todoAplicado =
    marcados.length > 0 && porAplicar.length === 0 && conflictos.length === 0

  const aplicar = (incluirConflictos: boolean) => {
    let nuevo = borrador
    let n = 0
    for (const d of marcados) {
      if (d.igual(nuevo)) continue
      if (d.vacio(nuevo) || incluirConflictos) {
        nuevo = d.aplicar(nuevo)
        n++
      }
    }
    if (n > 0) onAplicar(nuevo, n)
  }

  const alternar = (clave: string) =>
    setDesmarcados((prev) => {
      const n = new Set(prev)
      if (n.has(clave)) n.delete(clave)
      else n.add(clave)
      return n
    })

  return (
    <section
      aria-label="Lo que entendimos de tu descripción"
      className={cn(
        'rounded-card border border-border bg-surface p-5',
        className
      )}
    >
      <h2 className="kicker kicker-filete">Lo que entendimos</h2>

      <div aria-live="polite" className="mt-3">
        {estado.tipo === 'cargando' ? (
          <p className="flex items-center gap-2 text-body-s text-fg-muted">
            <Spinner className="text-fg-subtle" />
            Leyendo tu descripción…
          </p>
        ) : null}
        {estado.tipo === 'error' ? (
          <div className="text-body-s text-fg-muted">
            <p>{estado.mensaje}</p>
            <Button
              variant="link"
              className="mt-1.5 text-[15px]"
              onClick={onReintentar}
            >
              Reintentar
            </Button>
          </div>
        ) : null}
        {resultado && estado.tipo !== 'error' ? (
          <p
            className={cn(
              'text-body-s text-fg',
              estado.tipo === 'cargando' && 'mt-2 opacity-60'
            )}
          >
            {resultado.resumen}
          </p>
        ) : null}
      </div>

      {resultado && estado.tipo !== 'error' && lista.length > 0 ? (
        <>
          <div
            role="group"
            aria-label="Datos detectados (desmarca los que no quieras usar)"
            className="mt-4 flex flex-wrap gap-2"
          >
            {lista.map((d) => {
              const marcado = !desmarcados.has(d.clave)
              return (
                <Chip
                  key={d.clave}
                  size="sm"
                  selected={marcado}
                  aria-pressed={marcado}
                  icon={d.icono}
                  onClick={() => alternar(d.clave)}
                >
                  {d.etiqueta}
                </Chip>
              )
            })}
          </div>

          {resultado.supuestos.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1 text-caption text-fg-muted">
              {resultado.supuestos.slice(0, 3).map((s) => (
                <li key={s}>Supusimos: {s}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={porAplicar.length === 0 || estado.tipo === 'cargando'}
              onClick={() => aplicar(false)}
              className="-ml-3.5"
            >
              Aplicar al formulario
            </Button>
            {conflictos.length > 0 ? (
              <Button
                variant="link"
                className="text-[15px]"
                disabled={estado.tipo === 'cargando'}
                onClick={() => aplicar(true)}
              >
                Reemplazar también:{' '}
                {Array.from(new Set(conflictos.map((d) => d.campo))).join(', ')}
              </Button>
            ) : null}
          </div>
          {todoAplicado ? (
            <p className="mt-2 text-caption text-success-fg">
              Todo está aplicado al formulario.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
