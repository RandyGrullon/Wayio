'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Clock,
  ExternalLink,
  Hotel,
  Plane,
  Search,
  SearchX,
  Star,
  Ticket,
} from 'lucide-react'
import type { SearchResponse, SearchResult } from '@/lib/api/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton, SkeletonRegion } from '@/components/ui/Skeleton'
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/Tabs'
import {
  AFFILIATE_REL,
  describeFlightsLink,
  resolveIata,
} from '@/constants/affiliateLinks'
import { track } from '@/lib/analytics/events'
import type { ProveedorAfiliado } from '@/lib/analytics/events'
import {
  formatCurrency,
  formatDuracion,
  formatNumero,
} from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'

interface RealSearchProps {
  destino: string
  fechaInicio: string
  fechaFin: string
  personas: number
  origen: string
  /** Moneda del viaje (precios de actividades cuando el proveedor la admite). */
  moneda?: string
  /** Id del viaje (analítica). */
  tripId?: string
  className?: string
}

type Pestana = 'hoteles' | 'actividades' | 'vuelos'

type Seccion =
  | { estado: 'inactivo' }
  | { estado: 'cargando' }
  | { estado: 'listo'; data: SearchResponse }
  | { estado: 'error'; mensaje: string }

const INACTIVO: Seccion = { estado: 'inactivo' }

const VACIO_POR_DEFECTO: Record<Pestana, string> = {
  hoteles: 'La búsqueda de hoteles no está disponible ahora.',
  actividades: 'La búsqueda de actividades no está disponible ahora.',
  vuelos: 'La búsqueda de vuelos no está disponible ahora.',
}

const PROVEEDOR_LABEL: Record<SearchResult['provider'], string> = {
  viator: 'Viator',
}

async function buscar(url: string): Promise<Seccion> {
  try {
    const res = await fetch(url)
    const data = (await res.json().catch(() => null)) as SearchResponse | null
    if (data && Array.isArray(data.results)) {
      return { estado: 'listo', data }
    }
    return {
      estado: 'error',
      mensaje:
        res.status === 429
          ? 'Hiciste muchas búsquedas seguidas. Inténtalo en un minuto.'
          : 'No pudimos completar la búsqueda. Inténtalo de nuevo.',
    }
  } catch {
    return {
      estado: 'error',
      mensaje: 'No pudimos buscar. Revisa tu conexión e inténtalo de nuevo.',
    }
  }
}

/** Proveedor del enlace (analítica) a partir del dominio. */
function proveedorDe(url: string): ProveedorAfiliado {
  try {
    const host = new URL(url).hostname
    if (host.includes('booking.com')) {
      return url.includes('/cars') ? 'booking_cars' : 'booking'
    }
    if (host.includes('viator')) return 'viator'
    if (host.includes('skyscanner')) return 'skyscanner'
    if (host.includes('aviasales')) return 'aviasales'
    if (host.includes('google')) return 'google_flights'
    if (host.includes('airalo')) return 'airalo'
  } catch {
    // URL inválida: «otro».
  }
  return 'otro'
}

function dominioDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'el sitio del socio'
  }
}

/**
 * «Disponibilidad real» (docs/DISENO.md §6.5): pestañas Hoteles | Actividades
 * | Vuelos con el contrato de /api/hotels|activities|flights. Las búsquedas
 * se lanzan bajo demanda (al ver la sección y al abrir cada pestaña). Si un
 * proveedor no está configurado se muestra un vacío honesto con el enlace de
 * búsqueda del socio.
 */
export function RealSearch({
  destino,
  fechaInicio,
  fechaFin,
  personas,
  origen,
  moneda = 'USD',
  tripId,
  className,
}: RealSearchProps) {
  const seccionRef = useRef<HTMLElement | null>(null)
  const [pestana, setPestana] = useState<Pestana>('hoteles')
  const [visto, setVisto] = useState(false)
  const [secciones, setSecciones] = useState<Record<Pestana, Seccion>>({
    hoteles: INACTIVO,
    actividades: INACTIVO,
    vuelos: INACTIVO,
  })
  const [iataOrigen, setIataOrigen] = useState(
    () => resolveIata(origen) ?? origen
  )
  const [iataDestino, setIataDestino] = useState(
    () => resolveIata(destino) ?? destino
  )

  const clic = (url: string, categoria: 'vuelo' | 'hotel' | 'actividad') =>
    track('click_afiliado', {
      proveedor: proveedorDe(url),
      categoria,
      destino,
      tripId,
      ubicacion: 'disponibilidad-real',
    })

  const urlDe = useCallback(
    (p: Pestana): string => {
      const q = (o: Record<string, string>) => new URLSearchParams(o).toString()
      const gente = String(Math.min(20, Math.max(1, Math.round(personas || 1))))
      if (p === 'hoteles') {
        return `/api/hotels?${q({
          destination: destino,
          checkIn: fechaInicio,
          checkOut: fechaFin,
          guests: gente,
        })}`
      }
      if (p === 'actividades') {
        return `/api/activities?${q({
          destination: destino,
          date: fechaInicio,
          endDate: fechaFin,
          // La moneda del viaje (el contrato acepta USD, EUR y DOP).
          currency: moneda === 'EUR' || moneda === 'DOP' ? moneda : 'USD',
        })}`
      }
      return `/api/flights?${q({
        origin: iataOrigen.trim(),
        destination: iataDestino.trim(),
        date: fechaInicio,
        returnDate: fechaFin,
        adults: gente,
      })}`
    },
    [destino, fechaInicio, fechaFin, personas, moneda, iataOrigen, iataDestino]
  )

  const cargar = useCallback(
    (p: Pestana) => {
      setSecciones((s) => ({ ...s, [p]: { estado: 'cargando' } }))
      void buscar(urlDe(p)).then((resultado) =>
        setSecciones((s) => ({ ...s, [p]: resultado }))
      )
    },
    [urlDe]
  )

  // La primera búsqueda espera a que la sección se vea.
  useEffect(() => {
    const el = seccionRef.current
    if (!el || visto) return
    if (typeof IntersectionObserver === 'undefined') {
      const t = window.setTimeout(() => setVisto(true), 0)
      return () => window.clearTimeout(t)
    }
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisto(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visto])

  const seccionActual = secciones[pestana]
  useEffect(() => {
    if (!visto || seccionActual.estado !== 'inactivo' || !destino) return
    const t = window.setTimeout(() => cargar(pestana), 0)
    return () => window.clearTimeout(t)
  }, [visto, pestana, seccionActual.estado, destino, cargar])

  const onBuscarVuelos = (e: FormEvent) => {
    e.preventDefault()
    if (!iataOrigen.trim() || !iataDestino.trim()) return
    cargar('vuelos')
  }

  const vuelosRespaldo = describeFlightsLink({
    origen: iataOrigen || origen,
    destino: iataDestino || destino,
    ida: fechaInicio,
    vuelta: fechaFin,
    personas,
  })

  return (
    <section
      ref={seccionRef}
      aria-labelledby="disponibilidad-real"
      className={cn('scroll-mt-24', className)}
      data-print="hide"
    >
      <p className="kicker kicker-filete">Precios de socios</p>
      <h2
        id="disponibilidad-real"
        className="mt-3 font-display text-h2 text-fg"
      >
        Disponibilidad real
      </h2>
      <p className="mt-2 max-w-[60ch] text-body-s text-fg-muted">
        Opciones reales para tus fechas. Algunos enlaces son patrocinados: si
        reservas, Wayio puede recibir una comisión sin costo extra para ti.
      </p>

      <Tabs
        value={pestana}
        onValueChange={(v) => setPestana(v as Pestana)}
        className="mt-6"
        id="disponibilidad"
      >
        <TabList label="Tipo de búsqueda">
          <Tab value="hoteles" icon={<Hotel />}>
            Hoteles
          </Tab>
          <Tab value="actividades" icon={<Ticket />}>
            Actividades
          </Tab>
          <Tab value="vuelos" icon={<Plane />}>
            Vuelos
          </Tab>
        </TabList>

        <TabPanel value="hoteles" className="pt-6">
          <Resultados
            seccion={secciones.hoteles}
            pestana="hoteles"
            moneda={moneda}
            onReintentar={() => cargar('hoteles')}
            onClic={(url) => clic(url, 'hotel')}
          />
        </TabPanel>

        <TabPanel value="actividades" className="pt-6">
          <Resultados
            seccion={secciones.actividades}
            pestana="actividades"
            moneda={moneda}
            onReintentar={() => cargar('actividades')}
            onClic={(url) => clic(url, 'actividad')}
          />
        </TabPanel>

        <TabPanel value="vuelos" className="pt-6">
          <form
            onSubmit={onBuscarVuelos}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <Input
              label="Origen"
              fieldSize="md"
              value={iataOrigen}
              onChange={(e) => setIataOrigen(e.target.value)}
              hint="Código IATA o ciudad"
              className="font-mono uppercase"
              containerClassName="sm:w-44"
              maxLength={80}
              autoComplete="off"
              spellCheck={false}
            />
            <Input
              label="Destino"
              fieldSize="md"
              value={iataDestino}
              onChange={(e) => setIataDestino(e.target.value)}
              hint="Código IATA o ciudad"
              className="font-mono uppercase"
              containerClassName="sm:w-44"
              maxLength={80}
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="submit"
              variant="outline"
              icon={<Search />}
              loading={secciones.vuelos.estado === 'cargando'}
              loadingText="Buscando…"
              disabled={!iataOrigen.trim() || !iataDestino.trim()}
              className="sm:mb-[26px]"
            >
              Buscar vuelos
            </Button>
          </form>
          <div className="mt-6">
            <Resultados
              seccion={secciones.vuelos}
              pestana="vuelos"
              moneda={moneda}
              respaldo={vuelosRespaldo.url}
              onReintentar={() => cargar('vuelos')}
              onClic={(url) => clic(url, 'vuelo')}
            />
          </div>
        </TabPanel>
      </Tabs>
    </section>
  )
}

function Resultados({
  seccion,
  pestana,
  moneda,
  respaldo,
  onReintentar,
  onClic,
}: {
  seccion: Seccion
  pestana: Pestana
  moneda: string
  respaldo?: string
  onReintentar: () => void
  onClic: (url: string) => void
}) {
  if (seccion.estado === 'inactivo' || seccion.estado === 'cargando') {
    return (
      <SkeletonRegion label="Buscando opciones…">
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
            >
              <Skeleton className="h-4 w-3/4 rounded-[4px]" />
              <Skeleton className="h-3 w-1/2 rounded-[4px]" />
              <Skeleton className="mt-2 h-control-sm w-28 rounded-full" />
            </div>
          ))}
        </div>
      </SkeletonRegion>
    )
  }

  if (seccion.estado === 'error') {
    return (
      <Vacio
        icono={<SearchX />}
        titulo="No pudimos buscar ahora"
        texto={seccion.mensaje}
        accion={
          <Button variant="outline" size="sm" onClick={onReintentar}>
            Reintentar
          </Button>
        }
      />
    )
  }

  const { data } = seccion
  const enlace = data.enlace ?? respaldo
  if (!data.configured || data.results.length === 0) {
    // Fallo pasajero del proveedor: se puede reintentar aquí mismo.
    const pasajero =
      data.reason === 'error-proveedor' || data.reason === 'tiempo-agotado'
    return (
      <Vacio
        icono={<SearchX />}
        titulo={tituloVacio(data)}
        texto={
          data.mensaje ??
          (data.configured
            ? 'Prueba en el sitio del socio con otras fechas.'
            : VACIO_POR_DEFECTO[pestana])
        }
        accion={
          pasajero && !enlace ? (
            <Button variant="outline" size="sm" onClick={onReintentar}>
              Reintentar
            </Button>
          ) : enlace ? (
            <ButtonLink
              href={enlace}
              target="_blank"
              rel={AFFILIATE_REL}
              variant="outline"
              size="sm"
              iconEnd={<ExternalLink />}
              onClick={() => onClic(enlace)}
            >
              {pestana === 'vuelos'
                ? 'Ver vuelos disponibles'
                : pestana === 'hoteles'
                  ? 'Ver hoteles disponibles'
                  : 'Ver actividades'}
              <span className="sr-only">
                {' '}
                en {dominioDe(enlace)} (enlace patrocinado, se abre en otra
                pestaña)
              </span>
            </ButtonLink>
          ) : null
        }
      />
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {data.results.map((r) => (
        <li key={r.id}>
          <Card className="flex h-full flex-col gap-3 p-4 md:p-5">
            <div className="min-w-0">
              <p className="kicker">{PROVEEDOR_LABEL[r.provider] ?? 'Socio'}</p>
              <p className="mt-1.5 line-clamp-2 text-title text-fg">
                {r.title}
              </p>
              {r.subtitle ? (
                <p className="mt-1 line-clamp-2 text-caption text-fg-muted">
                  {r.subtitle}
                </p>
              ) : null}
            </div>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-fg-muted">
              {typeof r.rating === 'number' && r.rating > 0 ? (
                <li className="inline-flex items-center gap-1 tnum">
                  <Star
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-4 fill-current text-brass"
                  />
                  <span className="sr-only">Valoración: </span>
                  {formatNumero(r.rating, 1)}
                  {r.reviews ? (
                    <span>({formatNumero(r.reviews)} reseñas)</span>
                  ) : null}
                </li>
              ) : null}
              {r.durationMinutes ? (
                <li className="inline-flex items-center gap-1 tnum">
                  <Clock
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-4"
                  />
                  <span className="sr-only">Duración: </span>
                  {formatDuracion(r.durationMinutes)}
                </li>
              ) : null}
            </ul>
            <div className="mt-auto flex items-end justify-between gap-3">
              {typeof r.price === 'number' && r.price > 0 ? (
                <p className="text-body-s text-fg-muted">
                  desde{' '}
                  <span className="text-[18px] font-semibold text-fg tnum">
                    {formatCurrency(r.price, r.currency ?? moneda)}
                  </span>
                </p>
              ) : (
                <span />
              )}
              {r.url ? (
                <ButtonLink
                  href={r.url}
                  target="_blank"
                  rel={AFFILIATE_REL}
                  variant="outline"
                  size="sm"
                  iconEnd={<ExternalLink />}
                  onClick={() => onClic(r.url ?? '')}
                >
                  Ver opción
                  <span className="sr-only">
                    : {r.title} (enlace patrocinado, se abre en otra pestaña)
                  </span>
                </ButtonLink>
              ) : null}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  )
}

/** Título honesto del vacío según el motivo que da el contrato de búsqueda. */
function tituloVacio(data: SearchResponse): string {
  switch (data.reason) {
    case 'parametros-invalidos':
      return 'Revisa los datos de la búsqueda'
    case 'limite':
      return 'Hiciste muchas búsquedas seguidas'
    case 'error-proveedor':
    case 'tiempo-agotado':
      return 'No pudimos buscar ahora'
    case 'sin-proveedor':
    case 'no-configurado':
      return 'Precios en el sitio del socio'
    default:
      return data.configured
        ? 'Sin resultados para tus fechas'
        : 'Precios en el sitio del socio'
  }
}

function Vacio({
  icono,
  titulo,
  texto,
  accion,
}: {
  icono: ReactNode
  titulo: string
  texto: string
  accion?: ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-rule bg-surface p-5 sm:flex-row sm:items-center">
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-fg-muted [&_svg]:size-5 [&_svg]:stroke-[1.75]"
      >
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-fg">{titulo}</p>
        <p className="mt-0.5 text-body-s text-fg-muted">{texto}</p>
      </div>
      {accion}
    </div>
  )
}
