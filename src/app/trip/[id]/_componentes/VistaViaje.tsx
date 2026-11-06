'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  CalendarDays,
  CalendarPlus,
  CloudOff,
  Compass,
  Ellipsis,
  LogOut,
  Pencil,
  Printer,
  Share2,
  Ship,
  Undo2,
  Users,
  X,
} from 'lucide-react'
import type { Day, Trip } from '@/types/trip'
import type { Activity } from '@/types/activity'
import type { Alert } from '@/types/alerts'
import type { Conflict } from '@/types/conflicts'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { TripMap } from '@/components/map/TripMap'
import { AlertLevel5Cruise } from '@/components/alerts/AlertLevel5Cruise'
import { Badge, SelloInfo } from '@/components/ui/Badge'
import {
  Button,
  ButtonLink,
  Spinner,
  buttonClasses,
} from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Menu } from '@/components/ui/Menu'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Segmented'
import { useToast, useToastOffset } from '@/components/ui/Toast'
import { AjustarConIA } from '@/components/trip/AjustarConIA'
import { ConflictDisplay } from '@/components/trip/ConflictDisplay'
import { DayChapter } from '@/components/trip/DayChapter'
import { DayChips, useDiaVisible } from '@/components/trip/DayChips'
import { EditableDays } from '@/components/trip/EditableDays'
import {
  ReserveButton,
  reservasHabilitadas,
} from '@/components/trip/ReserveButton'
import { AntesDeIr, NotasDeRuta } from '@/components/trip/TripNotes'
import {
  PAQUETE_LABEL,
  monedaDelViaje,
  tieneCoords,
} from '@/components/trip/tripUtils'
import { useTrip } from '@/hooks/useTrip'
import type { PropuestaReagenda } from '@/hooks/useTrip'
import { useGPS } from '@/hooks/useGPS'
import { useOfflineTrip } from '@/hooks/useOfflineTrip'
import { detectarConflictosLocales } from '@/lib/ai/conflictosLocales'
import { resetAnalytics } from '@/lib/analytics/events'
import { signOut } from '@/lib/auth/actions'
import { clearOfflineData } from '@/lib/offline'
import { downloadIcs } from '@/lib/utils/ics'
import {
  formatDuracion,
  formatFaltan,
  formatFecha,
  formatFechaHora,
  formatHora12,
  formatRangoFechas,
  formatViajeros,
} from '@/lib/utils/formatters'
import { AlertasEnVivo } from './AlertasEnVivo'
import { AvisoPendiente } from './AvisoPendiente'
import { BarraInferior } from './BarraInferior'
import type { ItemBarra } from './BarraInferior'
import { CompartirSheet } from './CompartirSheet'
import { EsqueletoViaje } from './EsqueletoViaje'
import { PildoraGPS } from './PildoraGPS'
import { ReagendarSheet } from './ReagendarSheet'
import { TarjetaAhora } from './TarjetaAhora'
import { calcularEmbarque, calcularHoy } from './hoy'
import { useAhora } from './useAhora'
import { useEdicionViaje } from './useEdicionViaje'

type Vista = 'hoy' | 'itinerario'

const CLAVE_EMBARQUE = 'wayio:embarque-oculto'
const ID_INICIO = 'viaje-dias'

function leerOcultas(): string[] {
  try {
    const v = localStorage.getItem(CLAVE_EMBARQUE)
    const lista = v ? (JSON.parse(v) as unknown) : []
    return Array.isArray(lista)
      ? lista.filter((x): x is string => typeof x === 'string')
      : []
  } catch {
    return []
  }
}

function guardarOculta(clave: string): void {
  try {
    const lista = [...leerOcultas().filter((c) => c !== clave), clave].slice(
      -30
    )
    localStorage.setItem(CLAVE_EMBARQUE, JSON.stringify(lista))
  } catch {
    // Sin almacenamiento: se oculta solo en esta visita.
  }
}

/**
 * Viaje guardado / en vivo (docs/DISENO.md §6.6). Shell de cliente: los datos
 * llegan de /api/trips/[id] o, sin conexión, de la copia de IndexedDB.
 */
export function VistaViaje({ tripId }: { tripId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast, success, error: toastError } = useToast()
  const {
    trip: loadedTrip,
    tripId: rowId,
    grupoLink,
    actividadesPendientes,
    moneda,
    isPublic,
    esDueno,
    loading,
    error,
    errorCode,
    saveError,
    saving,
    loadTrip,
    markActivityLost,
    rescheduleActivity,
    acceptReschedule,
    guardarViaje,
    setPublic,
  } = useTrip(tripId)
  const gps = useGPS()
  const { isOnline, savedAt, cacheTrip, readCachedTrip } =
    useOfflineTrip(tripId)
  const ahora = useAhora()

  const [offlineTrip, setOfflineTrip] = useState<Trip | null>(null)
  const [vistaElegida, setVistaElegida] = useState<Vista | null>(null)
  const [compartirAbierto, setCompartirAbierto] = useState(false)
  const [masAbierto, setMasAbierto] = useState(false)
  const [mapaAbierto, setMapaAbierto] = useState(false)
  const [reagendar, setReagendar] = useState<{
    act: Activity
    dia: number
  } | null>(null)
  const [descartados, setDescartados] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [conflictosIA, setConflictosIA] = useState<{
    para: Trip
    lista: Conflict[]
  } | null>(null)
  const [revisando, setRevisando] = useState(false)
  const [ocultasSesion, setOcultasSesion] = useState<string[]>([])
  const [enfocarId, setEnfocarId] = useState<string | null>(null)
  const [saliendo, startSalida] = useTransition()
  const itinerarioRef = useRef<HTMLDivElement | null>(null)
  // Edición manual: borrador local de los días hasta «Guardar cambios».
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState<Day[] | null>(null)
  const [confirmarDescarte, setConfirmarDescarte] = useState(false)
  // Al guardar con el viaje cambiado desde que se empezó a editar.
  const [conflictoEdicion, setConflictoEdicion] = useState(false)
  // Viaje sobre el que se empezó a editar (para no pisar cambios de otra vía).
  const [baseEdicion, setBaseEdicion] = useState<Trip | null>(null)
  // Navegación interna o «Cerrar sesión» con cambios sin guardar.
  const [salida, setSalida] = useState<
    { tipo: 'ruta'; href: string } | { tipo: 'sesion' } | null
  >(null)
  // Copias síncronas: «Guardar» puede llegar justo tras un onChange.
  const borradorRef = useRef<Day[] | null>(null)
  const editadasRef = useRef<Set<string>>(new Set())

  const trip = loadedTrip ?? offlineTrip
  const desdeCache = !loadedTrip && offlineTrip !== null

  // ── Carga, copia offline y respaldo sin conexión ──────────────────────────
  useEffect(() => {
    void loadTrip()
  }, [loadTrip])

  useEffect(() => {
    if (loadedTrip) void cacheTrip(loadedTrip)
  }, [loadedTrip, cacheTrip])

  // El servidor dijo que no existe o que no tienes acceso: es el 404 (§6.6),
  // no un fallo de conexión, así que no se recurre a la copia guardada.
  const sinAcceso = errorCode === 'not_found' || errorCode === 'forbidden'

  useEffect(() => {
    if (loadedTrip || offlineTrip || sinAcceso) return
    if (!error && isOnline) return
    let activo = true
    void readCachedTrip(tripId).then((copia) => {
      if (activo && copia) setOfflineTrip(copia)
    })
    return () => {
      activo = false
    }
  }, [
    loadedTrip,
    offlineTrip,
    sinAcceso,
    error,
    isOnline,
    tripId,
    readCachedTrip,
  ])

  const destino = trip?.destino
  useEffect(() => {
    if (destino) document.title = `${destino} · Tu viaje | Wayio`
  }, [destino])

  useEffect(() => {
    if (saveError) toastError(saveError)
  }, [saveError, toastError])

  // ── Derivados ─────────────────────────────────────────────────────────────
  const monedaViaje = trip ? monedaDelViaje(trip, { moneda }) : moneda
  // Ajustar con IA, editar a mano y deshacer (solo el dueño, ver puedeEditar).
  // Mientras se edita o se reagenda, lo que llegue queda pendiente.
  const edicion = useEdicionViaje(loadedTrip, guardarViaje, {
    moneda: monedaViaje,
    enPausa: editando || reagendar !== null,
    guardando: saving,
  })
  const guardandoAlgo = saving || edicion.aplicando
  const hoy = useMemo(
    () => (trip && ahora ? calcularHoy(trip, ahora) : null),
    [trip, ahora]
  )
  const enCurso = hoy?.momento === 'durante'
  // Mientras se edita solo se ve el itinerario (el borrador).
  const vista: Vista = editando
    ? 'itinerario'
    : (vistaElegida ?? (enCurso ? 'hoy' : 'itinerario'))
  const diasVista = editando && borrador ? borrador : (trip?.dias ?? null)
  const diaVisible = useDiaVisible(
    itinerarioRef,
    `${vista}-${editando}-${diasVista?.length}`
  )
  const pendientes = loadedTrip
    ? actividadesPendientes
    : (trip?.actividadesPendientes ?? [])
  const puedeEditar = esDueno && isOnline && !desdeCache && Boolean(rowId)
  // «Me la perdí», la tarjeta de ahora y las alertas: no mientras se edita ni
  // mientras se guarda otro cambio (dos PUT a la vez pisarían datos).
  const puedeTocar = puedeEditar && !editando && !guardandoAlgo
  // El dueño con el viaje del servidor (no la copia offline): monta el FAB
  // «Ajustar con IA» aunque se corte la conexión, para no perder el chat.
  const conAjustes = esDueno && Boolean(rowId) && loadedTrip !== null
  const hayCambiosSinGuardar =
    editando && borrador !== null && borrador !== baseEdicion?.dias
  // Lo que se perdería al salir: el borrador o un ajuste de la IA sin aplicar.
  const hayQueAvisar = hayCambiosSinGuardar || edicion.pendiente?.tipo === 'ia'
  const reserva = searchParams.get('reserva')
  const esCrucero = Boolean(
    diasVista?.some((d) => d.actividades.some((a) => a.puertoCrucero))
  )

  const conflictosLocales = useMemo(
    () => (diasVista ? detectarConflictosLocales(diasVista) : []),
    [diasVista]
  )
  const conflictos = [
    ...conflictosLocales,
    ...(conflictosIA && conflictosIA.para === trip && !editando
      ? conflictosIA.lista
      : []),
  ].filter((c) => !descartados.has(c.id))

  // Los toasts quedan por encima de la barra inferior en móvil y, con el FAB
  // «Ajustar con IA» visible, también por encima de él.
  const conFab = conAjustes && isOnline && !editando
  useToastOffset(72, '(max-width: 767px)')
  useToastOffset(conFab ? 152 : 0, '(max-width: 767px)')
  useToastOffset(conFab ? 72 : 0)

  // Salir con cambios sin guardar pide confirmación: al cerrar o recargar
  // (beforeunload) y en los enlaces internos (cabecera, «Grupo»…), que se
  // interceptan antes de que Next navegue.
  useEffect(() => {
    if (!hayQueAvisar) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    const alClic = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return
      }
      const enlace =
        e.target instanceof Element ? e.target.closest('a[href]') : null
      if (!(enlace instanceof HTMLAnchorElement)) return
      if ((enlace.target && enlace.target !== '_self') || enlace.download) {
        return
      }
      const url = new URL(enlace.href, window.location.href)
      // Fuera de Wayio lo cubre beforeunload; las anclas de esta página no
      // salen de ella.
      if (url.origin !== window.location.origin) return
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      setSalida({
        tipo: 'ruta',
        href: `${url.pathname}${url.search}${url.hash}`,
      })
    }
    window.addEventListener('beforeunload', avisar)
    document.addEventListener('click', alClic, true)
    return () => {
      window.removeEventListener('beforeunload', avisar)
      document.removeEventListener('click', alClic, true)
    }
  }, [hayQueAvisar])

  const embarque = useMemo(
    () => (trip && ahora ? calcularEmbarque(trip, ahora, tripId) : null),
    [trip, ahora, tripId]
  )
  const embarqueVisible = useMemo(
    () =>
      embarque &&
      !ocultasSesion.includes(embarque.clave) &&
      !leerOcultas().includes(embarque.clave)
        ? embarque
        : null,
    [embarque, ocultasSesion]
  )

  const ubicacion =
    gps.estado === 'activa' && gps.location ? gps.location : undefined
  const foco = hoy ? (hoy.actual ?? hoy.siguiente) : null
  const focoLat = foco && tieneCoords(foco) ? foco.lat : null
  const focoLng = foco && tieneCoords(foco) ? foco.lng : null
  const siguiente = useMemo(
    () =>
      enCurso && focoLat !== null && focoLng !== null
        ? { lat: focoLat, lng: focoLng }
        : null,
    [enCurso, focoLat, focoLng]
  )
  const diaMapa = vista === 'hoy' ? (hoy?.indiceHoy ?? null) : diaVisible

  // ── Acciones ──────────────────────────────────────────────────────────────
  const abrirReagenda = useCallback(
    (act: Activity) => {
      if (!trip) return
      const i = trip.dias.findIndex((d) =>
        d.actividades.some((a) => a.id === act.id)
      )
      setReagendar({ act, dia: i >= 0 ? i + 1 : 1 })
    },
    [trip]
  )

  // Mueve la actividad al día propuesto y guarda (useTrip). Si falla, el hook
  // deja saveError y el efecto de arriba lo muestra en un toast.
  const aceptarReagenda = async (p: PropuestaReagenda): Promise<boolean> => {
    if (!loadedTrip || !rowId) return false
    const ok = await acceptReschedule(p)
    if (ok) {
      success(
        p.dia === p.diaOriginal
          ? 'Actividad reagendada'
          : `Actividad movida al día ${p.dia}`
      )
    }
    return ok
  }

  const revisarConIA = async () => {
    if (!trip) return
    const para = trip
    setRevisando(true)
    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dias: para.dias, ia: true }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        conflicts?: Conflict[]
        ia?: { estado?: string }
        error?: string
      }
      if (!res.ok) {
        toastError(data.error ?? 'No pudimos revisar el horario.')
        return
      }
      const deIA = (data.conflicts ?? [])
        .filter((c) => typeof c.id === 'string' && c.id.startsWith('ia-'))
        .map((c) => ({ ...c, soluciones: [] }))
      setConflictosIA({ para, lista: deIA })
      const estado = data.ia?.estado
      if (estado === 'no_disponible') {
        toast({ message: 'La revisión con IA no está disponible ahora.' })
      } else if (estado === 'limite') {
        toast({ message: 'Ya revisaste varias veces. Inténtalo más tarde.' })
      } else if (estado === 'error') {
        toastError('La IA no pudo revisar el horario. Inténtalo de nuevo.')
      } else if (deIA.length === 0) {
        success('La IA no encontró conflictos en tu horario')
      } else {
        toast({
          message:
            deIA.length === 1
              ? 'La IA encontró 1 aviso'
              : `La IA encontró ${deIA.length} avisos`,
        })
      }
    } catch {
      toastError('No pudimos revisar el horario. Revisa tu conexión.')
    } finally {
      setRevisando(false)
    }
  }

  const salirDeLaSesion = () =>
    startSalida(async () => {
      try {
        await clearOfflineData()
      } catch {
        // Limpieza best-effort.
      }
      try {
        resetAnalytics()
      } catch {
        // Sin analítica.
      }
      await signOut()
    })

  // Con cambios sin guardar, «Cerrar sesión» pregunta antes.
  const cerrarSesion = () => {
    if (!hayQueAvisar) {
      salirDeLaSesion()
      return
    }
    setMasAbierto(false)
    setSalida({ tipo: 'sesion' })
  }

  const alCalendario = () => {
    if (!trip) return
    downloadIcs(trip)
    success('Calendario descargado')
  }

  const verPuerto = () => {
    if (!embarqueVisible) return
    setOcultasSesion((o) => [...o, embarqueVisible.clave])
    setEnfocarId(embarqueVisible.actividad.id)
    window.setTimeout(() => setEnfocarId(null), 2000)
    if (window.matchMedia('(max-width: 1023px)').matches) setMapaAbierto(true)
  }

  const ocultarEmbarque = () => {
    if (!embarqueVisible) return
    guardarOculta(embarqueVisible.clave)
    setOcultasSesion((o) => [...o, embarqueVisible.clave])
  }

  // ── Edición manual ────────────────────────────────────────────────────────
  const entrarEdicion = () => {
    if (!loadedTrip || !puedeEditar || guardandoAlgo) return
    borradorRef.current = loadedTrip.dias
    editadasRef.current = new Set()
    setBaseEdicion(loadedTrip)
    setBorrador(loadedTrip.dias)
    setEditando(true)
    setVistaElegida('itinerario')
    window.requestAnimationFrame(() =>
      document.getElementById(ID_INICIO)?.scrollIntoView({ block: 'start' })
    )
  }

  const cambiarBorrador = (dias: Day[]) => {
    borradorRef.current = dias
    setBorrador(dias)
  }

  const salirEdicion = () => {
    borradorRef.current = null
    editadasRef.current = new Set()
    setBaseEdicion(null)
    setBorrador(null)
    setEditando(false)
    edicion.limpiarFalloManual()
  }

  // «Guardar cambios» (pasa antes por la confirmación de EditableDays si hay
  // una actividad abierta en el editor). Si falla, el borrador se conserva.
  // `aunqueCambio`: el viaje cambió por otra vía desde que se empezó a editar
  // y el usuario aceptó que sus días sustituyan a los de ahora.
  const guardarEdicion = async (aunqueCambio = false) => {
    const dias = borradorRef.current
    if (!loadedTrip || !dias || dias === baseEdicion?.dias) {
      salirEdicion()
      return
    }
    if (loadedTrip !== baseEdicion && !aunqueCambio) {
      setConflictoEdicion(true)
      return
    }
    const guardado = await edicion.guardarEdicion(
      { ...loadedTrip, dias },
      editadasRef.current
    )
    if (!guardado) return
    if (borradorRef.current === dias) {
      salirEdicion()
      return
    }
    // Se siguió editando mientras se guardaba: eso no se pierde. Lo guardado
    // pasa a ser la base y se sigue en modo edición.
    setBaseEdicion(guardado)
    toast({
      message: 'Guardamos tus cambios',
      description: 'Lo que editaste mientras se guardaba sigue sin guardar.',
    })
  }

  const descartarEdicion = () => {
    if (hayCambiosSinGuardar) setConfirmarDescarte(true)
    else salirEdicion()
  }

  const elegirBarra = (item: ItemBarra) => {
    if (item === 'mapa') setMapaAbierto(true)
    else if (item === 'mas') setMasAbierto(true)
    else if (editando && item === 'hoy') {
      toast({ message: 'Guarda o descarta tus cambios para ver «Hoy».' })
    } else {
      setVistaElegida(item === 'hoy' ? 'hoy' : 'itinerario')
      window.scrollTo({ top: 0 })
    }
  }

  const limpiarReserva = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('reserva')
    const q = params.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }

  // ── Sin viaje: carga o error ──────────────────────────────────────────────
  if (!trip) {
    return (
      <>
        <SiteHeader variant="app" />
        <main id="contenido" className="flex-1">
          {loading || !error ? (
            <EsqueletoViaje />
          ) : (
            <div className="mx-auto max-w-content px-4 md:px-6 lg:px-8">
              <EmptyState
                headingLevel="h1"
                illustration={isOnline ? 'sello' : 'error'}
                title={
                  isOnline
                    ? 'No pudimos abrir este viaje'
                    : 'Sin conexión y sin copia guardada'
                }
                description={
                  isOnline
                    ? error
                    : 'Este viaje no se guardó en este dispositivo. Conéctate para abrirlo.'
                }
                action={
                  sinAcceso ? (
                    <ButtonLink href="/viajes" variant="outline">
                      Volver a mis viajes
                    </ButtonLink>
                  ) : (
                    <Button variant="outline" onClick={() => void loadTrip()}>
                      Reintentar
                    </Button>
                  )
                }
                className="pt-20"
              />
            </div>
          )}
        </main>
      </>
    )
  }

  const alertaEmbarque: Alert | null = embarqueVisible
    ? {
        id: embarqueVisible.clave,
        level: 5,
        title: 'Regresa al barco',
        message: `Regresa al barco antes de las ${formatHora12(embarqueVisible.hora)} (en ${formatDuracion(embarqueVisible.minutosRestantes)}). Puerto: ${embarqueVisible.actividad.nombre}.`,
        activityId: embarqueVisible.actividad.id,
        timestamp: ahora?.getTime() ?? 0,
        acknowledged: false,
        actions: [{ label: 'Ver puerto en el mapa', type: 'navigate' }],
      }
    : null

  const diaHoy =
    hoy?.indiceHoy !== null && hoy?.indiceHoy !== undefined
      ? trip.dias[hoy.indiceHoy]
      : undefined
  // Lo que se pinta en el itinerario, los chips y el mapa (el borrador al editar).
  const diasMostrados = diasVista ?? trip.dias

  // Ajuste con IA o deshacer sin guardar: en la página y en el panel de la IA.
  const avisoPendiente = edicion.pendiente ? (
    <AvisoPendiente
      pendiente={edicion.pendiente}
      aplicando={guardandoAlgo}
      online={isOnline}
      editando={editando}
      saveError={saveError}
      onAplicar={edicion.aplicarPendiente}
      onDescartar={edicion.descartarPendiente}
    />
  ) : null

  const accionesHoy = (act: Activity) =>
    puedeTocar && act.estado !== 'perdida' && !act.esPerdida ? (
      <Button
        variant="ghost"
        size="sm"
        icon={<Undo2 />}
        onClick={() => abrirReagenda(act)}
        aria-label={`Me perdí ${act.nombre}`}
      >
        Me la perdí
      </Button>
    ) : null

  const momentoKicker =
    hoy?.momento === 'durante'
      ? 'En viaje'
      : hoy?.momento === 'despues'
        ? 'Viaje completado'
        : 'Viaje guardado'

  const masItems = [
    {
      key: 'calendario',
      label: 'Añadir al calendario',
      icon: <CalendarPlus />,
      onSelect: alCalendario,
    },
    {
      key: 'pdf',
      label: 'Exportar PDF',
      icon: <Printer />,
      onSelect: () => window.print(),
    },
    {
      key: 'ia',
      label: 'Revisar el horario con IA',
      icon: <Compass />,
      disabled: !isOnline || revisando || editando,
      onSelect: () => {
        setVistaElegida('itinerario')
        void revisarConIA()
      },
    },
  ]

  return (
    <>
      <SiteHeader variant="app" enVivo={gps.estado === 'activa'} />
      <main
        id="contenido"
        className="flex-1 pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0"
      >
        <div className="mx-auto w-full max-w-content px-4 pt-6 pb-16 md:px-6 md:pt-10 lg:px-8">
          {reserva === 'ok' || reserva === 'cancelada' ? (
            <Callout
              tone={reserva === 'ok' ? 'success' : 'info'}
              title={
                reserva === 'ok'
                  ? 'Reserva confirmada'
                  : 'No se completó el pago'
              }
              className="mb-6"
              action={
                <Button variant="link" onClick={limpiarReserva}>
                  Entendido
                </Button>
              }
            >
              {reserva === 'ok'
                ? 'Recibimos tu depósito. Te enviaremos el comprobante por email.'
                : 'Cancelaste el pago. Tu viaje sigue guardado y puedes reservar cuando quieras.'}
            </Callout>
          ) : null}

          {/* Un solo aviso de conexión */}
          {!isOnline ? (
            <Callout
              tone="warning"
              icon={CloudOff}
              title="Sin conexión"
              className="mb-6"
            >
              {savedAt
                ? `Te mostramos tu copia guardada del ${formatFechaHora(savedAt)}.`
                : 'Te mostramos la última versión que abriste.'}
            </Callout>
          ) : desdeCache ? (
            <Callout
              tone="warning"
              icon={CloudOff}
              title="No pudimos conectar"
              className="mb-6"
              action={
                <Button variant="link" onClick={() => void loadTrip()}>
                  Reintentar
                </Button>
              }
            >
              {savedAt
                ? `Te mostramos tu copia guardada del ${formatFechaHora(savedAt)}.`
                : 'Te mostramos tu copia guardada.'}
            </Callout>
          ) : null}

          {/* Portada compacta */}
          <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <p className="kicker kicker-filete">
                  {momentoKicker} · {PAQUETE_LABEL[trip.paquete] ?? 'Confort'}
                </p>
                {isOnline && savedAt && !desdeCache ? (
                  <SelloInfo tone="laton">
                    Disponible sin conexión · guardado{' '}
                    {formatFechaHora(savedAt)}
                  </SelloInfo>
                ) : null}
              </div>
              <h1 className="mt-3 font-display text-h1 text-fg">
                {trip.destino}
              </h1>
              <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-body-s text-fg-muted">
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
                {esCrucero ? (
                  <li>
                    <Badge variant="info">
                      <Ship aria-hidden="true" />
                      Crucero
                    </Badge>
                  </li>
                ) : null}
              </ul>
            </div>
            {hoy?.momento === 'antes' ? (
              <p className="text-num-l text-fg tnum">
                {formatFaltan(hoy.faltan)}
              </p>
            ) : hoy?.momento === 'durante' && hoy.indiceHoy !== null ? (
              <p className="text-num-l text-fg tnum">
                Día {hoy.indiceHoy + 1}{' '}
                <span className="text-fg-subtle">de {trip.dias.length}</span>
              </p>
            ) : null}
          </header>

          <div
            className="mt-6 flex flex-wrap items-center gap-3"
            data-print="hide"
          >
            <Segmented
              label="Vista del viaje"
              options={[
                { value: 'hoy', label: 'Hoy' },
                { value: 'itinerario', label: 'Itinerario' },
              ]}
              value={vista}
              onValueChange={(v) => setVistaElegida(v)}
              disabled={editando}
            />
            <div className="hidden items-center gap-2 md:flex">
              {puedeEditar && !editando ? (
                <Button
                  variant="outline"
                  icon={<Pencil />}
                  disabled={guardandoAlgo}
                  onClick={entrarEdicion}
                >
                  Editar
                </Button>
              ) : null}
              <Button
                variant="outline"
                icon={<Share2 />}
                onClick={() => setCompartirAbierto(true)}
              >
                Compartir
              </Button>
              {grupoLink ? (
                <ButtonLink
                  href={`/group/${grupoLink}`}
                  variant="outline"
                  icon={<Users />}
                >
                  Grupo
                </ButtonLink>
              ) : null}
              {esDueno && rowId && isOnline && reservasHabilitadas() ? (
                <ReserveButton
                  tripId={rowId}
                  moneda={monedaViaje}
                  size="md"
                  label="Reservar"
                />
              ) : null}
              <Menu
                label="Más acciones"
                trigger={
                  <Ellipsis
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-[18px]"
                  />
                }
                triggerClassName={buttonClasses({
                  variant: 'outline',
                  size: 'icon',
                })}
                items={masItems}
              />
            </div>
            {saving || edicion.aplicando ? (
              <span className="inline-flex items-center gap-2 text-body-s text-fg-muted">
                <Spinner />
                Guardando…
              </span>
            ) : null}
            <PildoraGPS
              className="sm:ml-auto"
              estado={gps.estado}
              error={gps.error}
              onActivar={gps.startWatching}
              onDesactivar={gps.stopWatching}
            />
          </div>

          {avisoPendiente ? <div className="mt-6">{avisoPendiente}</div> : null}

          <div className="mt-8 grid gap-8 lg:grid-cols-12 xl:gap-10">
            <aside
              aria-label="Mapa del viaje"
              className="lg:order-2 lg:col-span-5"
              data-print="hide"
            >
              <div className="h-[40dvh] min-h-60 lg:sticky lg:top-20 lg:h-[calc(100dvh-104px)]">
                <TripMap
                  dias={diasMostrados}
                  diaEnfocado={diaMapa}
                  userLocation={ubicacion}
                  siguiente={siguiente}
                  enfocarActividadId={enfocarId}
                  isCrucero={esCrucero}
                  moneda={monedaViaje}
                  etiqueta={`Mapa de ${trip.destino}`}
                  className="h-full w-full shadow-card"
                />
              </div>
            </aside>

            <div
              ref={itinerarioRef}
              id={ID_INICIO}
              className="min-w-0 scroll-mt-20 lg:order-1 lg:col-span-7"
            >
              {vista === 'hoy' ? (
                <div className="flex flex-col gap-10">
                  {hoy?.momento === 'durante' &&
                  hoy.indiceHoy !== null &&
                  ahora ? (
                    <>
                      <TarjetaAhora
                        hoy={hoy}
                        ahora={ahora}
                        puedeReagendar={puedeTocar}
                        onPerdida={abrirReagenda}
                      />
                      {diaHoy ? (
                        <DayChapter
                          dia={diaHoy}
                          indice={hoy.indiceHoy}
                          trip={trip}
                          moneda={monedaViaje}
                          idPrefijo="hoy"
                          accionesActividad={accionesHoy}
                        />
                      ) : null}
                    </>
                  ) : hoy?.momento === 'antes' ? (
                    <>
                      <Card>
                        <p className="kicker">Tu viaje empieza</p>
                        <p className="mt-2 font-display text-h2 text-fg">
                          {formatFecha(trip.fechaInicio, { anio: true })}
                        </p>
                        <p className="mt-2 text-body-s text-fg-muted">
                          {formatFaltan(hoy.faltan)}. Aquí verás cada día lo que
                          toca, con el mapa y cómo llegar.
                        </p>
                      </Card>
                      {trip.dias[0] ? (
                        <DayChapter
                          dia={trip.dias[0]}
                          indice={0}
                          trip={trip}
                          moneda={monedaViaje}
                          idPrefijo="hoy"
                        />
                      ) : null}
                    </>
                  ) : hoy?.momento === 'despues' ? (
                    <EmptyState
                      title="Viaje completado"
                      description={`Esperamos que hayas disfrutado ${trip.destino}. Tu itinerario sigue aquí para recordarlo.`}
                      action={
                        <Button
                          variant="outline"
                          onClick={() => setVistaElegida('itinerario')}
                        >
                          Ver el itinerario
                        </Button>
                      }
                    />
                  ) : null}
                  <ParaTuProximaVisita pendientes={pendientes} />
                </div>
              ) : (
                <div>
                  <section
                    aria-labelledby="revision-horario"
                    className="mb-10"
                    data-print="hide"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 id="revision-horario" className="text-title text-fg">
                        Revisión del horario
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Compass />}
                        loading={revisando}
                        loadingText="Revisando…"
                        disabled={!isOnline || editando}
                        onClick={() => void revisarConIA()}
                      >
                        Revisar con IA
                      </Button>
                    </div>
                    {conflictos.length > 0 ? (
                      <ConflictDisplay
                        className="mt-4 flex flex-col gap-3"
                        conflicts={conflictos}
                        onDismiss={(id) =>
                          setDescartados((s) => new Set([...s, id]))
                        }
                      />
                    ) : (
                      <p className="mt-2 text-body-s text-fg-muted">
                        No vemos choques de horario en tu itinerario.
                      </p>
                    )}
                  </section>

                  <DayChips
                    dias={diasMostrados}
                    trip={trip}
                    activo={diaVisible}
                    onElegir={() => undefined}
                    idInicio={ID_INICIO}
                  />
                  <AntesDeIr
                    advertencias={trip.advertencias}
                    className="mt-6"
                  />
                  {editando && edicion.falloManual ? (
                    <Callout
                      tone="danger"
                      title="No se guardaron tus cambios"
                      className="mt-6"
                      data-print="hide"
                    >
                      {saveError ?? 'No pudimos guardar los cambios.'} Siguen
                      aquí: vuelve a pulsar «Guardar cambios».
                    </Callout>
                  ) : null}
                  <div className="mt-8">
                    <EditableDays
                      dias={diasMostrados}
                      editing={editando}
                      onChange={cambiarBorrador}
                      onTerminar={() => void guardarEdicion()}
                      onActividadesEditadas={(ids) => {
                        for (const id of ids) editadasRef.current.add(id)
                      }}
                      moneda={monedaViaje}
                      trip={trip}
                      resaltados={edicion.resaltados}
                      claveResaltado={edicion.claveResaltado}
                      textoListo="Guardar cambios"
                      listoCargando={edicion.aplicando}
                      listoDeshabilitado={!isOnline || saving}
                      accionEdicion={
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<X />}
                          disabled={edicion.aplicando}
                          onClick={descartarEdicion}
                        >
                          Descartar
                        </Button>
                      }
                      avisoEdicion={
                        isOnline
                          ? 'Reordena, edita o borra actividades. Arrastra el asa o usa las flechas del teclado para moverlas. Al terminar, guarda los cambios.'
                          : 'Sin conexión: puedes seguir editando y guardar cuando vuelvas a conectarte.'
                      }
                    />
                  </div>
                  <NotasDeRuta consejos={trip.consejos} className="mt-14" />
                  <ParaTuProximaVisita
                    pendientes={pendientes}
                    className="mt-10"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <BarraInferior
        activo={
          mapaAbierto
            ? 'mapa'
            : masAbierto
              ? 'mas'
              : vista === 'hoy'
                ? 'hoy'
                : 'dias'
        }
        onElegir={elegirBarra}
      />

      <CompartirSheet
        open={compartirAbierto}
        onClose={() => setCompartirAbierto(false)}
        tripId={rowId}
        destino={trip.destino}
        grupoLink={grupoLink}
        isPublic={isPublic}
        esDueno={esDueno}
        online={isOnline}
        setPublic={setPublic}
      />

      <Modal
        open={masAbierto}
        onClose={() => setMasAbierto(false)}
        title="Más"
        variant="sheet"
      >
        <div className="flex flex-col gap-1 pb-2">
          <Button
            variant="ghost"
            icon={<Share2 />}
            className="justify-start"
            onClick={() => {
              setMasAbierto(false)
              setCompartirAbierto(true)
            }}
          >
            Compartir
          </Button>
          {puedeEditar && !editando ? (
            <Button
              variant="ghost"
              icon={<Pencil />}
              className="justify-start"
              disabled={guardandoAlgo}
              onClick={() => {
                setMasAbierto(false)
                entrarEdicion()
              }}
            >
              Editar el itinerario
            </Button>
          ) : null}
          {grupoLink ? (
            <ButtonLink
              href={`/group/${grupoLink}`}
              variant="ghost"
              icon={<Users />}
              className="justify-start"
            >
              Sala del grupo
            </ButtonLink>
          ) : null}
          {masItems.map((item) => (
            <Button
              key={item.key}
              variant="ghost"
              icon={item.icon}
              disabled={item.disabled}
              className="justify-start"
              onClick={() => {
                setMasAbierto(false)
                item.onSelect()
              }}
            >
              {item.label}
            </Button>
          ))}
          <Button
            variant="ghost"
            icon={<LogOut />}
            className="mt-2 justify-start border-t border-border"
            loading={saliendo}
            loadingText="Cerrando sesión…"
            onClick={cerrarSesion}
          >
            Cerrar sesión
          </Button>
          {esDueno && rowId && isOnline && reservasHabilitadas() ? (
            <ReserveButton
              tripId={rowId}
              moneda={monedaViaje}
              fullWidth
              className="mt-3"
            />
          ) : null}
        </div>
      </Modal>

      <Modal
        open={mapaAbierto}
        onClose={() => setMapaAbierto(false)}
        title={`Mapa de ${trip.destino}`}
        variant="sheet"
        className="h-[92dvh]"
        bodyClassName="-mx-5 -mb-4 flex"
      >
        <TripMap
          dias={diasMostrados}
          diaEnfocado={diaMapa}
          userLocation={ubicacion}
          siguiente={siguiente}
          enfocarActividadId={enfocarId}
          isCrucero={esCrucero}
          moneda={monedaViaje}
          cooperativo={false}
          etiqueta={`Mapa de ${trip.destino}`}
          className="min-h-[60dvh] w-full flex-1 rounded-none"
        />
      </Modal>

      <ReagendarSheet
        actividad={reagendar?.act ?? null}
        diaActual={reagendar?.dia ?? 1}
        tripId={rowId}
        onClose={() => setReagendar(null)}
        marcarPerdida={markActivityLost}
        reagendar={rescheduleActivity}
        aceptar={aceptarReagenda}
      />

      {/* Solo el dueño (los miembros del grupo ven el viaje en lectura). */}
      {conAjustes && edicion.tripIA ? (
        <AjustarConIA
          trip={edicion.tripIA}
          onAdjusted={edicion.aplicarAjuste}
          puedeDeshacer={edicion.puedeDeshacer}
          onDeshacer={edicion.deshacer}
          onEditarManual={entrarEdicion}
          conBarraInferior
          loginRedirect={`/trip/${tripId}`}
          ocupado={guardandoAlgo}
          oculto={editando || !isOnline}
          // Con un ajuste pendiente no se pide otro: se resuelve antes.
          bloqueado={edicion.pendiente !== null}
          aviso={avisoPendiente}
        />
      ) : null}

      <ConfirmDialog
        open={conflictoEdicion}
        onClose={() => setConflictoEdicion(false)}
        tone="neutral"
        title="El viaje cambió mientras editabas"
        description="Se guardó otro cambio en el viaje después de que empezaras a editar. Si guardas, tus días sustituyen a los del viaje actual."
        confirmLabel="Guardar mis cambios"
        loadingLabel="Guardando…"
        cancelLabel="Seguir editando"
        onConfirm={() => guardarEdicion(true)}
      />

      <ConfirmDialog
        open={salida !== null}
        onClose={() => setSalida(null)}
        tone="neutral"
        title="¿Salir sin guardar?"
        description={
          hayCambiosSinGuardar
            ? 'Tienes cambios en el itinerario sin guardar. Si sales ahora, se pierden.'
            : 'Tienes un ajuste con IA sin aplicar. Si sales ahora, se pierde.'
        }
        confirmLabel={
          salida?.tipo === 'sesion' ? 'Cerrar sesión' : 'Salir sin guardar'
        }
        cancelLabel="Quedarme"
        onConfirm={() => {
          const destino = salida
          setSalida(null)
          if (!destino) return
          salirEdicion()
          edicion.descartarPendiente()
          if (destino.tipo === 'sesion') salirDeLaSesion()
          else router.push(destino.href)
        }}
      />

      <ConfirmDialog
        open={confirmarDescarte}
        onClose={() => setConfirmarDescarte(false)}
        tone="neutral"
        title="¿Descartar los cambios?"
        description="Lo que cambiaste en el itinerario no se guardará. Tu viaje se queda como estaba."
        confirmLabel="Descartar cambios"
        cancelLabel="Seguir editando"
        onConfirm={salirEdicion}
      />

      {alertaEmbarque ? (
        <AlertLevel5Cruise
          alert={alertaEmbarque}
          onDismiss={ocultarEmbarque}
          onAction={verPuerto}
        />
      ) : null}
      <AlertasEnVivo
        tripId={tripId}
        dia={diaHoy}
        ubicacion={ubicacion}
        ahora={ahora}
        esCrucero={esCrucero}
        pausada={alertaEmbarque !== null || reagendar !== null || editando}
        onMover={puedeTocar ? abrirReagenda : undefined}
        onSaltar={puedeTocar ? (act) => markActivityLost(act.id) : undefined}
      />
    </>
  )
}

function ParaTuProximaVisita({
  pendientes,
  className,
}: {
  pendientes: Activity[]
  className?: string
}) {
  if (pendientes.length === 0) return null
  return (
    <section aria-labelledby="proxima-visita" className={className}>
      <Card>
        <p className="kicker">Pendientes</p>
        <h2 id="proxima-visita" className="mt-2 font-display text-h3 text-fg">
          Para tu próxima visita
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-body-s text-fg-muted marker:text-brass">
          {pendientes.map((a) => (
            <li key={a.id}>{a.nombre}</li>
          ))}
        </ul>
      </Card>
    </section>
  )
}
