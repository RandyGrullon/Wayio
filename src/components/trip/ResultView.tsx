'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Dispatch, JSX, ReactNode, SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { m, useIsPresent } from 'framer-motion'
import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  Maximize2,
  Users,
} from 'lucide-react'
import type { Trip } from '@/types/trip'
import type { WeatherData } from '@/lib/api/openweather'
import type { TripForm } from '@/lib/validations/tripForm'
import { Postal } from '@/components/brand/Postal'
import { TripMap } from '@/components/map/TripMap'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Modal } from '@/components/ui/Modal'
import { useToast, useToastOffset } from '@/components/ui/Toast'
import { SPRING } from '@/components/ui/motion'
import { downloadIcs } from '@/lib/utils/ics'
import {
  formatCoordenadas,
  formatCurrency,
  formatDias,
  formatFecha,
  formatNumero,
  formatRangoFechas,
  formatViajeros,
} from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { AjustarConIA } from './AjustarConIA'
import { CopiarEnlace } from './CopiarEnlace'
import { DayChips, useDiaVisible } from './DayChips'
import { EditableDays, ID_LISTO_EDICION } from './EditableDays'
import { RealSearch } from './RealSearch'
import { ReserveButton, reservasHabilitadas } from './ReserveButton'
import { ResultActions } from './ResultActions'
import { AntesDeIr, NotasDeRuta } from './TripNotes'
import { TripEssentials } from './TripEssentials'
import { Dinero } from './Dinero'
import { IconoClima, textoClima } from './clima'
import { calcularTotal, seleccionInicial } from './totalEstimado'
import type { SeleccionExtras } from './totalEstimado'
import {
  PAQUETE_LABEL,
  aplicarCoords,
  cambiosEntre,
  contarActividades,
  coordenadasDelViaje,
  geocodificar,
  lugaresSinVerificar,
  monedaDelViaje,
  resumenDeCambios,
} from './tripUtils'

export interface ResultViewProps {
  trip: Trip
  /** setState del trip (ediciones, ajustes IA, geocodificación de fondo). */
  setTrip: Dispatch<SetStateAction<Trip | null>>
  weather: WeatherData | null
  /** Datos del formulario que originó el viaje (presupuesto, moneda, origen…). */
  form: TripForm | null
  demo: { motivo?: string } | null
  isAuthed: boolean
  saving: boolean
  sharing: boolean
  shareUrl: string | null
  /**
   * id de la fila guardada (trips.id) tras guardar o compartir; NO es el id
   * del itinerario. Habilita la reserva con depósito y «Ver en Mis viajes».
   */
  tripIdGuardado?: string | null
  onSave: () => void
  onShare: () => void
  onRegenerate: () => void
  onChangePackage: () => void
  onNewTrip: () => void
}

/** Id del H1 de la portada (el flujo le pasa el foco al cambiar de paso). */
export const ID_TITULO_RESULTADO = 'titulo-itinerario'
const ID_INICIO = 'itinerario-inicio'
const MAX_DESHACER = 10

/**
 * Resultado del itinerario (docs/DISENO.md §6.5): portada, franja de datos,
 * mapa sticky, chips de día sincronizados con el scroll y el mapa, capítulos
 * con timeline, modo edición, «Antes de ir», «Notas de ruta», «Completa tu
 * viaje» con el TOTAL ESTIMADO único, «Disponibilidad real», FAB «Ajustar con
 * IA» (con deshacer) e impresión (un día por página).
 */
export function ResultView(props: ResultViewProps): JSX.Element {
  const {
    trip,
    setTrip,
    weather,
    form,
    demo,
    isAuthed,
    saving,
    sharing,
    shareUrl,
    tripIdGuardado = null,
    onSave,
    onShare,
    onRegenerate,
    onChangePackage,
    onNewTrip,
  } = props
  const { toast, success } = useToast()
  // Los toasts («3 cambios · Deshacer») suben por encima del FAB «Ajustar con
  // IA» (52 px + margen) en todos los anchos: en desktop comparten esquina.
  useToastOffset(72)
  const idResumen = useId()
  const moneda = monedaDelViaje(trip, form)
  const tripConMoneda = useMemo<Trip>(
    () => (trip.moneda ? trip : { ...trip, moneda }),
    [trip, moneda]
  )

  // ── Estado ────────────────────────────────────────────────────────────────
  const [editando, setEditando] = useState(false)
  const [seleccion, setSeleccion] = useState<SeleccionExtras>(() =>
    seleccionInicial(trip)
  )
  const [seleccionDe, setSeleccionDe] = useState(trip.id)
  if (seleccionDe !== trip.id) {
    // Otra versión del viaje: los extras vuelven a su valor por defecto.
    setSeleccionDe(trip.id)
    setSeleccion(seleccionInicial(trip))
  }
  const [historial, setHistorial] = useState<Trip[]>([])
  const [resaltados, setResaltados] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [claveResaltado, setClaveResaltado] = useState(0)
  const [mapaAmpliado, setMapaAmpliado] = useState(false)
  const [leerMas, setLeerMas] = useState(false)
  const [pieImpresion, setPieImpresion] = useState<string | null>(null)

  const itinerarioRef = useRef<HTMLDivElement | null>(null)
  const tripRef = useRef(trip)
  const historialRef = useRef(historial)
  useEffect(() => {
    tripRef.current = trip
    historialRef.current = historial
  })

  const diaVisible = useDiaVisible(
    itinerarioRef,
    `${editando}-${trip.dias.length}`
  )

  // Pie de impresión con la URL y la fecha (solo al imprimir).
  useEffect(() => {
    const antes = () =>
      setPieImpresion(
        `${window.location.href} · Impreso el ${formatFecha(new Date(), { anio: true })}`
      )
    window.addEventListener('beforeprint', antes)
    return () => window.removeEventListener('beforeprint', antes)
  }, [])

  // ── Derivados ─────────────────────────────────────────────────────────────
  // Mismo cálculo (y mismos viajeros) que la tarjeta TOTAL ESTIMADO.
  const desglose = calcularTotal(
    { ...tripConMoneda, personas: form?.personas || trip.personas },
    seleccion,
    form ? { monto: form.presupuesto, moneda: form.moneda } : null
  )
  const coords = coordenadasDelViaje(trip)
  const totalActividades = contarActividades(trip)
  const origen = form?.origen ?? trip.origen
  const resumenLargo = (trip.resumenViaje?.length ?? 0) > 240
  const clima = weather ? textoClima(weather, trip.destino) : null

  // ── Geocodificación de lo nuevo o editado ─────────────────────────────────
  const geocodificarIds = useCallback(
    (ids: ReadonlySet<string>) => {
      window.setTimeout(() => {
        const lugares = lugaresSinVerificar(tripRef.current, ids)
        if (lugares.length === 0) return
        void geocodificar(lugares).then((c) => {
          if (c.size > 0)
            setTrip((prev) => (prev ? aplicarCoords(prev, c) : prev))
        })
      }, 60)
    },
    [setTrip]
  )

  // ── Ajustes con IA ────────────────────────────────────────────────────────
  const deshacer = useCallback(() => {
    const h = historialRef.current
    const previo = h[h.length - 1]
    if (!previo) return
    setHistorial(h.slice(0, -1))
    setTrip(previo)
    setResaltados(new Set())
    toast({ message: 'Deshicimos el último ajuste' })
  }, [setTrip, toast])

  const alAjustar = (nuevo: Trip, resumen: string) => {
    const anterior = tripRef.current
    const { ids, porDia } = cambiosEntre(anterior, nuevo)
    setHistorial((h) => [...h, anterior].slice(-MAX_DESHACER))
    setTrip(nuevo)
    setResaltados(ids)
    setClaveResaltado((k) => k + 1)
    toast({
      message: resumenDeCambios(porDia),
      description: resumen,
      action: { label: 'Deshacer', onClick: deshacer },
    })
    if (ids.size > 0) geocodificarIds(ids)
  }

  // ── Acciones ──────────────────────────────────────────────────────────────
  const alternarEdicion = () => {
    if (!editando) {
      setEditando(true)
      return
    }
    // «Listo» pasa por el aviso de edición (confirma si hay un borrador).
    const listo = document.getElementById(ID_LISTO_EDICION)
    if (listo) listo.click()
    else setEditando(false)
  }

  const alCalendario = () => {
    downloadIcs(trip)
    success('Calendario descargado', {
      description: 'Ábrelo para añadir las actividades a tu calendario.',
    })
  }

  // La reserva necesita la fila guardada (trips.id): el servidor calcula el
  // depósito con lo guardado. Sin guardar, el botón lleva a guardar.
  const reserva = !reservasHabilitadas() ? null : tripIdGuardado ? (
    <ReserveButton tripId={tripIdGuardado} moneda={moneda} />
  ) : (
    <div className="flex flex-col gap-2">
      <Button
        variant="tinta"
        size="lg"
        icon={<CreditCard />}
        onClick={onSave}
        loading={saving}
        loadingText="Guardando…"
      >
        Guarda el viaje para reservar
      </Button>
      <p className="text-caption text-fg-muted">
        Cuando esté guardado podrás reservar con un depósito del 15 %.
      </p>
    </div>
  )

  const kicker = `Itinerario · ${PAQUETE_LABEL[trip.paquete] ?? 'Confort'} · ${formatDias(trip.dias.length)}`

  return (
    <div className="mx-auto w-full max-w-content px-4 pt-8 pb-28 md:px-6 md:pt-12 lg:px-8">
      {demo ? (
        <Callout
          tone="warning"
          title="Te mostramos un ejemplo"
          className="mb-8"
          action={
            <Button variant="link" onClick={onRegenerate}>
              Reintentar
            </Button>
          }
        >
          {demo.motivo?.trim() ||
            'La generación con IA no está disponible ahora mismo: este itinerario es de muestra y no corresponde a tu destino.'}
        </Callout>
      ) : null}

      {/* ── Portada ───────────────────────────────────────────────────────── */}
      <header className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-8">
        <div className="min-w-0 lg:col-span-7">
          <p className="kicker kicker-filete">{kicker}</p>
          {/* §7.3 Versiones → Itinerario: el destino viaja desde el chip del
              resumen (layoutId compartido). w-fit: la caja abraza el texto y
              el FLIP escala sin deformarlo. En la demo no hay relevo: el
              chip dice el destino pedido y la portada el del ejemplo. */}
          <m.h1
            id={ID_TITULO_RESULTADO}
            tabIndex={-1}
            {...(demo ? {} : { layoutId: 'trip-destino' })}
            transition={SPRING.suave}
            className="mt-4 w-fit max-w-full font-display text-display-l text-fg focus:outline-none"
          >
            <em className="italic">{trip.destino}</em>
          </m.h1>
          <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-body-s text-fg-muted">
            <li className="inline-flex items-center gap-2">
              <CalendarDays
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-[18px] text-fg-subtle"
              />
              {formatRangoFechas(trip.fechaInicio, trip.fechaFin)}
            </li>
            <li className="inline-flex items-center gap-2">
              <Users
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-[18px] text-fg-subtle"
              />
              {formatViajeros(trip.personas)}
            </li>
            {coords ? (
              <li className="font-mono text-data text-fg-subtle">
                <span className="sr-only">Coordenadas: </span>
                {formatCoordenadas(coords.lat, coords.lng)}
              </li>
            ) : null}
          </ul>
          {trip.resumenViaje ? (
            <div className="mt-5">
              <p
                id={idResumen}
                className={cn(
                  'max-w-[60ch] text-lead text-fg-muted',
                  resumenLargo &&
                    !leerMas &&
                    'line-clamp-3 print:line-clamp-none'
                )}
              >
                {trip.resumenViaje}
              </p>
              {resumenLargo ? (
                <Button
                  variant="link"
                  aria-expanded={leerMas}
                  aria-controls={idResumen}
                  onClick={() => setLeerMas((v) => !v)}
                  className="mt-1"
                  data-print="hide"
                >
                  {leerMas ? 'Leer menos' : 'Leer más'}
                </Button>
              ) : null}
            </div>
          ) : null}

          <ResultActions
            className="mt-7"
            isAuthed={isAuthed}
            saving={saving}
            sharing={sharing}
            editing={editando}
            onSave={onSave}
            onToggleEdit={alternarEdicion}
            onChangePackage={onChangePackage}
            onShare={onShare}
            onRegenerate={onRegenerate}
            onCalendar={alCalendario}
            onPrint={() => window.print()}
            onNewTrip={onNewTrip}
          />
          {tripIdGuardado ? (
            <ButtonLink
              href={`/trip/${tripIdGuardado}`}
              variant="link"
              iconEnd={<ArrowRight />}
              className="mt-4"
              data-print="hide"
            >
              Ver en Mis viajes
            </ButtonLink>
          ) : null}
          {shareUrl ? (
            <CopiarEnlace
              url={shareUrl}
              etiqueta="Enlace de solo lectura"
              ayuda="Quien lo abra verá el plan, sin poder editarlo."
              className="mt-5 max-w-xl"
            />
          ) : null}
        </div>
        {/* §7.3: la tarjeta de la versión elegida se convierte en la postal. */}
        <m.div
          layoutId={`version-${trip.paquete}`}
          transition={SPRING.suave}
          className="lg:col-span-5"
          data-print="hide"
        >
          <Postal
            semilla={trip.destino}
            proporcion="4:3"
            sello={trip.destino}
            selloTono="laton"
            como="div"
            arteClassName="max-h-[320px]"
          />
        </m.div>
      </header>

      {/* ── Franja de datos ───────────────────────────────────────────────── */}
      <dl className="mt-12 grid grid-cols-2 border-y border-border md:grid-cols-4">
        <Celda etiqueta="Total estimado" indice={0}>
          <Dinero valor={desglose.total} moneda={moneda} />
        </Celda>
        {clima ? (
          <Celda etiqueta={clima.etiqueta} indice={1}>
            <span className="inline-flex items-center gap-2">
              <IconoClima
                codigo={weather?.icon}
                className="size-5 shrink-0 text-fg-subtle"
              />
              <span className="text-[17px] leading-snug font-semibold">
                {clima.valor}
              </span>
            </span>
          </Celda>
        ) : (
          <Celda etiqueta="Duración" indice={1}>
            {formatDias(trip.dias.length)}
          </Celda>
        )}
        <Celda etiqueta="Actividades" indice={2}>
          {formatNumero(totalActividades)}
        </Celda>
        <Celda etiqueta="Por persona" indice={3}>
          <Dinero valor={desglose.porPersona} moneda={moneda} />
        </Celda>
      </dl>

      {/* ── Cuerpo: capítulos + mapa sticky ───────────────────────────────── */}
      <div
        id={ID_INICIO}
        className="mt-10 grid scroll-mt-20 gap-8 lg:grid-cols-12 xl:gap-10"
      >
        <aside
          aria-label="Mapa del itinerario"
          className="lg:order-2 lg:col-span-5"
          data-print="hide"
        >
          <div className="relative h-60 lg:sticky lg:top-20 lg:h-[calc(100dvh-104px)]">
            <TripMap
              dias={trip.dias}
              diaEnfocado={diaVisible}
              moneda={moneda}
              isCrucero={trip.dias.some((d) =>
                d.actividades.some((a) => a.puertoCrucero)
              )}
              className="h-full w-full shadow-card"
            >
              <Button
                variant="tinta"
                size="sm"
                icon={<Maximize2 />}
                onClick={() => setMapaAmpliado(true)}
                className="absolute bottom-3 left-3 z-10 lg:hidden"
              >
                Ampliar mapa
              </Button>
            </TripMap>
          </div>
        </aside>

        <div ref={itinerarioRef} className="min-w-0 lg:order-1 lg:col-span-7">
          <DayChips
            dias={trip.dias}
            trip={trip}
            activo={diaVisible}
            onElegir={() => undefined}
            idInicio={ID_INICIO}
          />
          <AntesDeIr advertencias={trip.advertencias} className="mt-6" />
          <div className="mt-8">
            <EditableDays
              dias={trip.dias}
              editing={editando}
              onChange={(dias) =>
                setTrip((prev) => (prev ? { ...prev, dias } : prev))
              }
              onTerminar={() => setEditando(false)}
              onActividadesEditadas={(ids) => geocodificarIds(new Set(ids))}
              moneda={moneda}
              trip={trip}
              resaltados={resaltados}
              claveResaltado={claveResaltado}
              animar
            />
          </div>
          <NotasDeRuta consejos={trip.consejos} className="mt-14" />
        </div>
      </div>

      {/* ── Anexos (no se imprimen) ───────────────────────────────────────── */}
      <div className="mt-20 flex flex-col gap-20" data-print="hide">
        <TripEssentials
          itinerary={tripConMoneda}
          origen={origen}
          personas={form?.personas ?? trip.personas}
          fechaInicio={trip.fechaInicio}
          fechaFin={trip.fechaFin}
          seleccion={seleccion}
          onSeleccionChange={setSeleccion}
          presupuesto={
            form ? { monto: form.presupuesto, moneda: form.moneda } : null
          }
          reserva={reserva}
          tripId={trip.id}
        />
        <RealSearch
          destino={trip.destino}
          fechaInicio={trip.fechaInicio}
          fechaFin={trip.fechaFin}
          personas={form?.personas ?? trip.personas}
          origen={origen}
          moneda={moneda}
          tripId={trip.id}
        />
      </div>

      <footer className="mt-12 hidden border-t border-border pt-4 text-caption text-fg-muted print:block">
        Wayio · Traza tu viaje · Vive el camino
        {pieImpresion ? ` · ${pieImpresion}` : ''} · Total estimado{' '}
        {formatCurrency(desglose.total, moneda)} (importes orientativos en{' '}
        {moneda})
      </footer>

      {/* El FAB es fixed: va en <body> (ver EnBody). */}
      <EnBody>
        <AjustarConIA
          trip={tripConMoneda}
          onAdjusted={alAjustar}
          puedeDeshacer={historial.length > 0}
          onDeshacer={deshacer}
          onEditarManual={() => {
            setEditando(true)
            document
              .getElementById(ID_INICIO)
              ?.scrollIntoView({ block: 'start' })
          }}
        />
      </EnBody>

      <Modal
        open={mapaAmpliado}
        onClose={() => setMapaAmpliado(false)}
        title="Mapa del viaje"
        variant="sheet"
        className="h-[92dvh]"
        bodyClassName="-mx-5 -mb-4 flex"
      >
        <TripMap
          dias={trip.dias}
          moneda={moneda}
          cooperativo={false}
          etiqueta={`Mapa de ${trip.destino}`}
          className="min-h-[60dvh] w-full flex-1 rounded-none"
        />
      </Modal>
    </div>
  )
}

/**
 * Monta lo fijo (FAB «Ajustar con IA») en <body> con un portal: los pasos del
 * planificador se deslizan con transform y un ancestro transformado rompe el
 * `position: fixed`. Mientras el paso sale (AnimatePresence) no se pinta: el
 * portal no hereda la animación de salida y se solaparía con el paso nuevo.
 */
function EnBody({ children }: { children: ReactNode }) {
  const presente = useIsPresent()
  if (!presente || typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

/** Celda de la franja de datos (2×2 en móvil, 4 en fila desde md). */
function Celda({
  etiqueta,
  indice,
  children,
}: {
  etiqueta: string
  indice: number
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'min-w-0 px-4 py-5 md:px-6',
        indice % 2 === 0 && 'border-r border-border',
        indice < 2 && 'border-b border-border md:border-b-0',
        indice === 1 && 'md:border-r',
        indice === 0 && 'pl-0 md:pl-0',
        indice === 2 && 'pl-0 md:pl-6'
      )}
    >
      <dt className="kicker">{etiqueta}</dt>
      <dd className="mt-2 text-[24px] leading-tight font-semibold text-fg tnum">
        {children}
      </dd>
    </div>
  )
}
