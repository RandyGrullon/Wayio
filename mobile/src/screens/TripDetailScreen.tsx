import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
  Badge,
  Button,
  Callout,
  Card,
  CardKicker,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Pantalla,
  ScreenHeader,
  SelloInfo,
  Sheet,
  Skeleton,
  SkeletonRegion,
  Txt,
  useToast,
} from '../components/ui'
import { DayCard } from '../components/trip/DayCard'
import { EditableDays } from '../components/trip/EditableDays'
import { AdjustChat } from '../components/trip/AdjustChat'
import { RealSearch } from '../components/trip/RealSearch'
import { TripEssentials } from '../components/trip/TripEssentials'
import {
  CalendarDays,
  Compass,
  Link2,
  MessagesSquare,
  MoreHorizontal,
  Navigation,
  PenLine,
  Share2,
  Trash2,
  UserPlus,
  Users,
} from '../components/ui/iconos'
import {
  diasHasta,
  formatDias,
  formatFaltan,
  formatFecha,
  formatHora12,
  formatRangoFechas,
  formatViajeros,
  horaDesdeMinutos,
  minutosDelDia,
  monedaDe,
  sumarDias,
} from '../components/ui/formato'
import { useNavigation } from '../navigation/NavigationContext'
import { useAuth } from '../context/AuthContext'
import {
  deleteTrip,
  getTrip,
  setTripPublic,
  updateTrip,
} from '../lib/trips/repository'
import {
  BackendError,
  huecosDelError,
  rescheduleActivityDetailed,
  validateScheduleDetailed,
  type RescheduleResult,
  type RescheduleSlot,
} from '../lib/api/backend'
import { esRequierePro, TEXTO_REAGENDAR_PRO } from '../lib/api/limites'
import { config } from '../config'
import { colorDia, useEstilos, useTheme, type Tema } from '../theme'
import type {
  Conflict,
  PlanningActivity,
  PlanningDay,
  PlanningTrip,
  TripRow,
} from '../types/planning'

const PAQUETE: Record<string, string> = {
  basico: 'Básico',
  confort: 'Confort',
  premium: 'Premium',
}

type EstadoReagendar =
  | { paso: 'pregunta'; actividad: PlanningActivity }
  | { paso: 'buscando'; actividad: PlanningActivity }
  | {
      paso: 'sugerencia'
      actividad: PlanningActivity
      resultado: RescheduleResult
    }
  | {
      paso: 'error'
      actividad: PlanningActivity
      mensaje: string
      huecos: RescheduleSlot[]
      /** 503 motivo 'requiere_pro': en Gratis se elige el hueco a mano. */
      requierePro: boolean
    }

function diaDe(trip: PlanningTrip, actId: string): number | null {
  for (const d of trip.dias) {
    if (d.actividades.some((a) => a.id === actId)) return d.numero
  }
  return null
}

/** Quita la actividad de su día y la coloca (ordenada por hora) en `dia`. */
function moverActividad(
  trip: PlanningTrip,
  actividad: PlanningActivity,
  dia: number
): PlanningTrip {
  const destino = trip.dias.some((d) => d.numero === dia)
    ? dia
    : (diaDe(trip, actividad.id) ?? trip.dias[0]?.numero ?? 1)
  return {
    ...trip,
    dias: trip.dias.map((d) => {
      const sin = d.actividades.filter((a) => a.id !== actividad.id)
      if (d.numero !== destino) return { ...d, actividades: sin }
      const con = [...sin, actividad].sort(
        (a, b) =>
          (minutosDelDia(a.horaInicio) ?? 0) -
          (minutosDelDia(b.horaInicio) ?? 0)
      )
      return { ...d, actividades: con }
    }),
  }
}

/** Ids nuevos o con nombre/hora distintos tras un ajuste con IA. */
function idsCambiados(antes: PlanningTrip, despues: PlanningTrip): Set<string> {
  const previo = new Map<string, PlanningActivity>()
  for (const d of antes.dias) for (const a of d.actividades) previo.set(a.id, a)
  const out = new Set<string>()
  for (const d of despues.dias) {
    for (const a of d.actividades) {
      const p = previo.get(a.id)
      if (!p || p.nombre !== a.nombre || p.horaInicio !== a.horaInicio) {
        out.add(a.id)
      }
    }
  }
  return out
}

/**
 * iOS no presenta un modal (ConfirmDialog, hoja nativa de Compartir) mientras
 * otro se está cerrando: se espera a que termine el fundido de la hoja.
 */
const ESPERA_MODAL = Platform.OS === 'ios' ? 350 : 0
const esperar = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** Alto que ocupan el FAB «Ajustar con IA» o la barra de edición (+ aire). */
const OFFSET_TOAST = 64

function tonoConflicto(
  sev: Conflict['severidad']
): 'danger' | 'warning' | 'info' {
  if (sev === 'critico') return 'danger'
  if (sev === 'advertencia') return 'warning'
  return 'info'
}

/**
 * Viaje guardado (§6.5–§6.6 en móvil): portada, acciones, avisos, días como
 * capítulos con chips de día fijos, edición, «Completa tu viaje»,
 * disponibilidad real y «Ajustar con IA» con deshacer. Cada guardado espera a
 * Supabase y, si falla (p. ej., un miembro que no es el dueño, M16), revierte
 * y lo explica.
 */
export function TripDetailScreen({
  tripId,
}: {
  tripId: string
}): React.ReactElement {
  const { navigate, reset, route } = useNavigation()
  const { tier, user } = useAuth()
  const toast = useToast()
  const { setOffset: setOffsetToast } = toast
  const { colors, days } = useTheme()
  const styles = useEstilos(crearEstilos)
  const insets = useSafeAreaInsets()

  const [row, setRow] = useState<TripRow | null>(null)
  const [trip, setTrip] = useState<PlanningTrip | null>(null)
  const [pendientes, setPendientes] = useState<PlanningActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [revisando, setRevisando] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDias, setEditDias] = useState<PlanningDay[]>([])
  const [descartar, setDescartar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [sheet, setSheet] = useState<'compartir' | 'mas' | 'ajustar' | null>(
    null
  )
  const [borrarViaje, setBorrarViaje] = useState(false)
  const [diaFiltro, setDiaFiltro] = useState<number | 'todo'>('todo')
  const [resumenAbierto, setResumenAbierto] = useState(false)
  const [esPublico, setEsPublico] = useState(false)
  const [anterior, setAnterior] = useState<PlanningTrip | null>(null)
  const [resaltadas, setResaltadas] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [reagendar, setReagendar] = useState<EstadoReagendar | null>(null)
  /** Petición de reagendar en curso (cerrar la hoja la invalida). */
  const reagendarVigente = useRef(0)
  const cerrarReagendar = (): void => {
    reagendarVigente.current += 1
    setReagendar(null)
  }

  // Últimos valores para los callbacks diferidos (toasts con «Deshacer»).
  const ultimo = useRef<{
    trip: PlanningTrip | null
    pend: PlanningActivity[]
  }>({ trip: null, pend: [] })
  useEffect(() => {
    ultimo.current = { trip, pend: pendientes }
  }, [trip, pendientes])

  const load = useCallback(async () => {
    try {
      setError(null)
      const r = await getTrip(tripId)
      if (!r) {
        setError('No encontramos este viaje o ya no tienes acceso.')
        return
      }
      setRow(r)
      setTrip(r.data)
      setPendientes(r.actividades_pendientes ?? [])
      setEsPublico(Boolean(r.is_public))
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No pudimos cargar el viaje. Inténtalo de nuevo.'
      )
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  // Validación local (sin IA) al cargar y al cambiar el itinerario.
  useEffect(() => {
    if (!trip) return
    const id = setTimeout(() => {
      validateScheduleDetailed(trip.dias)
        .then((r) => setConflicts(r.conflicts))
        .catch(() => undefined)
    }, 800)
    return () => clearTimeout(id)
  }, [trip])

  const esDueno = Boolean(row && user && row.user_id === user.id)
  const moneda = monedaDe(trip)
  const hayViaje = trip !== null

  // Los toasts suben por encima del FAB o de la barra de edición mientras
  // esta pantalla está arriba en la pila (si no, tapan «Ajustar con IA»).
  const enCima = route.name === 'trip' && route.tripId === tripId
  const conBarra = editing || esDueno
  useEffect(() => {
    if (!enCima || !hayViaje || !conBarra) return
    setOffsetToast(OFFSET_TOAST)
    return () => setOffsetToast(0)
  }, [enCima, hayViaje, conBarra, setOffsetToast])

  /** Guarda en Supabase; si falla revierte al estado previo y lo explica. */
  const persist = useCallback(
    async (
      next: PlanningTrip,
      nextPend: PlanningActivity[],
      previo: { trip: PlanningTrip; pend: PlanningActivity[] }
    ): Promise<boolean> => {
      setGuardando(true)
      try {
        await updateTrip(tripId, {
          data: next,
          actividades_pendientes: nextPend,
        })
        return true
      } catch (e) {
        setTrip(previo.trip)
        setPendientes(previo.pend)
        toast.error(
          e instanceof Error
            ? e.message
            : 'No pudimos guardar los cambios. Inténtalo de nuevo.'
        )
        return false
      } finally {
        setGuardando(false)
      }
    },
    [tripId, toast]
  )

  const aplicar = useCallback(
    (next: PlanningTrip, nextPend: PlanningActivity[]): Promise<boolean> => {
      const previo = {
        trip: ultimo.current.trip ?? next,
        pend: ultimo.current.pend,
      }
      setTrip(next)
      setPendientes(nextPend)
      return persist(next, nextPend, previo)
    },
    [persist]
  )

  // ── Reagendar (3 pasos) ─────────────────────────────────────────────────
  const confirmarPerdida = async (buscar: boolean): Promise<void> => {
    if (!trip || !reagendar) return
    const act = reagendar.actividad
    const next: PlanningTrip = {
      ...trip,
      dias: trip.dias.map((d) => ({
        ...d,
        actividades: d.actividades.map((a) =>
          a.id === act.id ? { ...a, estado: 'perdida', esPerdida: true } : a
        ),
      })),
    }
    const nextPend = pendientes.some((p) => p.id === act.id)
      ? pendientes
      : [...pendientes, act]
    void aplicar(next, nextPend)

    if (!buscar) {
      setReagendar(null)
      return
    }
    if (tier === 'free') {
      setReagendar(null)
      navigate({ name: 'paywall' })
      return
    }
    setReagendar({ paso: 'buscando', actividad: act })
    const peticion = ++reagendarVigente.current
    try {
      // El tiempo límite (60 s) ya lo pone lib/api/http.ts.
      const r = await rescheduleActivityDetailed(
        act.id,
        tripId,
        'El viajero la perdió o no pudo asistir'
      )
      // Si el viajero cerró la hoja mientras buscábamos, no se reabre.
      if (peticion !== reagendarVigente.current) return
      setReagendar({ paso: 'sugerencia', actividad: act, resultado: r })
    } catch (e) {
      if (peticion !== reagendarVigente.current) return
      const huecos = e instanceof BackendError ? huecosDelError(e.data) : []
      setReagendar({
        paso: 'error',
        actividad: act,
        mensaje:
          e instanceof Error
            ? e.message
            : 'No pudimos buscar una nueva hora ahora mismo.',
        huecos,
        requierePro: e instanceof BackendError && esRequierePro(e.data),
      })
    }
  }

  const colocar = (act: PlanningActivity, dia: number): void => {
    const actual = ultimo.current.trip
    if (!actual) return
    const next = moverActividad(actual, act, dia)
    const nextPend = ultimo.current.pend.filter((a) => a.id !== act.id)
    void aplicar(next, nextPend).then((ok) => {
      if (!ok) return
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      )
      toast.success(`Actividad reagendada al día ${dia}`)
    })
    setReagendar(null)
  }

  const aceptarSugerencia = (
    act: PlanningActivity,
    r: RescheduleResult
  ): void => {
    colocar(
      {
        ...r.activity,
        id: act.id,
        estado: 'pendiente',
        esPerdida: false,
        reagendadaDesdeDia: r.activity.reagendadaDesdeDia ?? r.diaOriginal,
      },
      r.dia
    )
  }

  const elegirHueco = (act: PlanningActivity, h: RescheduleSlot): void => {
    const desde = minutosDelDia(h.desde) ?? 9 * 60
    const hasta = minutosDelDia(h.hasta) ?? desde + act.duracionMinutos
    const fin = Math.min(hasta, desde + Math.max(15, act.duracionMinutos))
    colocar(
      {
        ...act,
        horaInicio: h.desde,
        horaFin: horaDesdeMinutos(fin),
        estado: 'pendiente',
        esPerdida: false,
        reagendadaDesdeDia:
          (ultimo.current.trip ? diaDe(ultimo.current.trip, act.id) : null) ??
          h.dia,
      },
      h.dia
    )
  }

  // ── Ajuste con IA y deshacer ────────────────────────────────────────────
  const restaurar = useCallback(
    (t: PlanningTrip) => {
      void aplicar(t, ultimo.current.pend).then((ok) => {
        if (ok) toast.success('Ajuste deshecho')
      })
      setAnterior(null)
    },
    [aplicar, toast]
  )

  const handleAdjusted = (updated: PlanningTrip, resumen: string): void => {
    const previo = ultimo.current.trip
    if (!previo) return
    const cambiados = idsCambiados(previo, updated)
    setAnterior(previo)
    setResaltadas(cambiados)
    setTimeout(() => setResaltadas(new Set()), 1200)
    void aplicar(updated, ultimo.current.pend)
    setSheet(null)
    const n = cambiados.size
    toast.toast(
      n > 0 ? `${n} ${n === 1 ? 'cambio' : 'cambios'} · ${resumen}` : resumen,
      'exito',
      { accion: { label: 'Deshacer', onPress: () => restaurar(previo) } }
    )
  }

  const revisarConIA = async (): Promise<void> => {
    if (!trip || revisando) return
    setRevisando(true)
    try {
      const r = await validateScheduleDetailed(trip.dias, { ia: true })
      setConflicts(r.conflicts)
      const estado = r.ia.estado
      if (estado === 'ok' || estado === 'cache') {
        toast.success(
          r.conflicts.length > 0
            ? 'Revisado con IA: mira los avisos.'
            : 'Revisado con IA: no vimos problemas.'
        )
      } else if (estado === 'limite') {
        toast.error(
          'Llegaste al límite de revisiones con IA. Inténtalo más tarde.'
        )
      } else if (estado === 'no_disponible') {
        toast.error('La revisión con IA no está disponible ahora.')
      } else if (estado === 'error') {
        toast.error('No pudimos revisar con IA. Inténtalo más tarde.')
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No pudimos revisar con IA ahora.'
      )
    } finally {
      setRevisando(false)
    }
  }

  // ── Edición ─────────────────────────────────────────────────────────────
  const startEditing = (): void => {
    if (!trip) return
    setEditDias(trip.dias)
    setEditing(true)
  }

  const saveEditing = async (): Promise<void> => {
    if (!trip) return
    const ok = await aplicar({ ...trip, dias: editDias }, pendientes)
    if (ok) {
      setEditing(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      )
      toast.success('Cambios guardados')
    }
  }

  const cancelarEdicion = (): void => {
    if (trip && editDias !== trip.dias) setDescartar(true)
    else setEditing(false)
  }

  // ── Compartir ───────────────────────────────────────────────────────────
  const urlPublica = config.webUrl
    ? `${config.webUrl}/viaje-compartido/${tripId}`
    : `wayio://viaje-compartido/${tripId}`

  const compartirVista = async (): Promise<void> => {
    if (!trip) return
    try {
      if (esDueno && !esPublico) {
        await setTripPublic(tripId, true)
        setEsPublico(true)
      }
      setSheet(null)
      await esperar(ESPERA_MODAL)
      await Share.share({
        message: `Mira mi viaje a ${trip.destino} en Wayio: ${urlPublica}`,
      })
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No pudimos compartir el viaje.'
      )
    }
  }

  const dejarDeCompartir = async (): Promise<void> => {
    try {
      await setTripPublic(tripId, false)
      setEsPublico(false)
      toast.success('La vista de solo lectura ya no se comparte')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No pudimos cambiarlo.')
    }
  }

  const invitar = async (): Promise<void> => {
    const link = row?.grupo_link
    if (!link) return
    const url = config.webUrl
      ? `${config.webUrl}/group/${link}`
      : `wayio://group/${link}`
    setSheet(null)
    await esperar(ESPERA_MODAL)
    await Share.share({ message: `Únete a mi viaje en Wayio: ${url}` }).catch(
      () => undefined
    )
  }

  const diasVisibles = useMemo(
    () =>
      trip
        ? diaFiltro === 'todo'
          ? trip.dias
          : trip.dias.filter((d) => d.numero === diaFiltro)
        : [],
    [trip, diaFiltro]
  )

  // ── Estados de carga / error ────────────────────────────────────────────
  if (loading) {
    return (
      <Pantalla>
        <ScreenHeader title="Viaje" />
        <SkeletonRegion label="Cargando el viaje…" style={styles.margen}>
          <Skeleton width="45%" height={12} style={styles.hueco} />
          <Skeleton width="80%" height={34} style={styles.hueco} />
          <Skeleton width="60%" height={14} style={styles.hueco} />
          <Skeleton
            width="100%"
            height={52}
            radius={26}
            style={styles.huecoGrande}
          />
          {[0, 1, 2].map((k) => (
            <View key={k} style={styles.esqueletoFila}>
              <Skeleton width={48} height={14} />
              <View style={styles.flex}>
                <Skeleton width="70%" height={14} />
                <Skeleton width="40%" height={12} style={styles.hueco} />
              </View>
            </View>
          ))}
        </SkeletonRegion>
      </Pantalla>
    )
  }

  if (error || !trip) {
    return (
      <Pantalla>
        <ScreenHeader title="Viaje" />
        <EmptyState
          ilustracion="error"
          title="Este viaje no está en el mapa"
          description={error ?? 'No encontramos este viaje.'}
          action={{
            label: 'Reintentar',
            onPress: () => {
              setLoading(true)
              void load()
            },
          }}
        />
      </Pantalla>
    )
  }

  const faltan = diasHasta(trip.fechaInicio)
  const rango = formatRangoFechas(trip.fechaInicio, trip.fechaFin)

  return (
    <Pantalla>
      <ScreenHeader
        title={trip.destino}
        subtitle={rango}
        right={
          <>
            <IconButton
              label="Compartir"
              icon={Share2}
              onPress={() => setSheet('compartir')}
            />
            <IconButton
              label="Más opciones"
              icon={MoreHorizontal}
              onPress={() => setSheet('mas')}
            />
          </>
        }
      />

      <ScrollView
        stickyHeaderIndices={editing ? [] : [2]}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
      >
        {/* 0 · Portada */}
        <View style={styles.margen}>
          <Txt variant="overline" color="fgMuted" style={styles.hueco}>
            Itinerario · {PAQUETE[trip.paquete] ?? 'Confort'} ·{' '}
            {formatDias(trip.dias.length)}
          </Txt>
          <Txt variant="displayL" italic style={styles.h1}>
            {trip.destino}
          </Txt>
          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <CalendarDays
                size={16}
                color={colors.fgMuted}
                strokeWidth={1.75}
              />
              <Txt variant="bodyS" color="fgMuted">
                {rango}
              </Txt>
            </View>
            <View style={styles.metaItem}>
              <Users size={16} color={colors.fgMuted} strokeWidth={1.75} />
              <Txt variant="bodyS" color="fgMuted">
                {formatViajeros(trip.personas)}
              </Txt>
            </View>
          </View>
          <View style={styles.sellos}>
            {!esDueno ? (
              <SelloInfo tone="laton">
                Compartido contigo · solo lectura
              </SelloInfo>
            ) : null}
            {esPublico ? (
              <SelloInfo tone="tinta">Vista pública activa</SelloInfo>
            ) : null}
            {guardando ? (
              <View style={styles.guardando} accessibilityLiveRegion="polite">
                <ActivityIndicator size="small" color={colors.fgMuted} />
                <Txt variant="caption" color="fgMuted">
                  Guardando…
                </Txt>
              </View>
            ) : null}
          </View>
          {faltan > 0 ? (
            <Txt variant="num" tnum style={styles.faltan}>
              {formatFaltan(faltan)}
            </Txt>
          ) : null}
          {trip.resumenViaje ? (
            <View style={styles.resumen}>
              <Txt
                variant="body"
                color="fgMuted"
                numberOfLines={resumenAbierto ? undefined : 3}
              >
                {trip.resumenViaje}
              </Txt>
              {trip.resumenViaje.length > 140 ? (
                <Button
                  variant="link"
                  title={resumenAbierto ? 'Leer menos' : 'Leer más'}
                  onPress={() => setResumenAbierto((v) => !v)}
                />
              ) : null}
            </View>
          ) : null}

          <Button
            title="Modo en vivo"
            icon={Navigation}
            size="lg"
            fullWidth
            accessibilityHint="Sigue el día con GPS y avisos"
            onPress={() => navigate({ name: 'live', trip, tripId })}
            style={styles.vivo}
          />
          <View style={styles.acciones}>
            {esDueno && !editing ? (
              <Button
                title="Editar"
                variant="outline"
                icon={PenLine}
                onPress={startEditing}
              />
            ) : null}
            <Button
              title="Grupo"
              variant="outline"
              icon={MessagesSquare}
              onPress={() => navigate({ name: 'group', trip, tripId })}
            />
          </View>
        </View>

        {/* 1 · Avisos */}
        <View style={styles.margen}>
          {conflicts.length > 0 ? (
            <View style={styles.seccion}>
              {conflicts.map((c) => (
                <Callout
                  key={c.id}
                  tone={tonoConflicto(c.severidad)}
                  title={c.titulo}
                  style={styles.aviso}
                >
                  {c.descripcion}
                </Callout>
              ))}
            </View>
          ) : null}
          <Button
            title="Revisar con IA"
            variant="ghost"
            size="sm"
            icon={Compass}
            loading={revisando}
            loadingText="Revisando…"
            accessibilityHint="Busca choques de horario y traslados imposibles"
            onPress={() => void revisarConIA()}
            style={styles.revisar}
          />
          {trip.advertencias.length > 0 ? (
            <Callout tone="warning" title="Antes de ir" style={styles.aviso}>
              <View style={styles.lista}>
                {trip.advertencias.map((a) => (
                  <Txt key={a} variant="bodyS" color="warningFg">
                    · {a}
                  </Txt>
                ))}
              </View>
            </Callout>
          ) : null}
          {editing ? (
            <Callout tone="info" title="Modo edición" style={styles.aviso}>
              Mueve, edita, borra o añade actividades. Guarda al terminar.
            </Callout>
          ) : null}
        </View>

        {/* 2 · Chips de día (fijos) */}
        {editing ? (
          <View />
        ) : (
          <View style={[styles.chipsBarra, { backgroundColor: colors.bg }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              accessibilityRole="tablist"
              accessibilityLabel="Días del viaje"
            >
              <ChipDia
                etiqueta="Todo"
                seleccionado={diaFiltro === 'todo'}
                onPress={() => setDiaFiltro('todo')}
              />
              {trip.dias.map((d) => (
                <ChipDia
                  key={d.numero}
                  etiqueta={String(d.numero).padStart(2, '0')}
                  detalle={formatFecha(
                    sumarDias(trip.fechaInicio, d.numero - 1),
                    {
                      diaSemana: false,
                    }
                  )}
                  color={colorDia(days, d.numero)}
                  accesible={`Día ${d.numero}`}
                  seleccionado={diaFiltro === d.numero}
                  onPress={() => setDiaFiltro(d.numero)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* 3 · Días */}
        <View style={styles.margen}>
          {editing ? (
            <EditableDays
              dias={editDias}
              onChange={setEditDias}
              moneda={moneda}
            />
          ) : (
            diasVisibles.map((d) => (
              <DayCard
                key={d.numero}
                day={d}
                fechaInicio={trip.fechaInicio}
                moneda={moneda}
                resaltadas={resaltadas}
                {...(esDueno
                  ? {
                      onMarkLost: (a: PlanningActivity) =>
                        setReagendar({ paso: 'pregunta', actividad: a }),
                    }
                  : {})}
              />
            ))
          )}
        </View>

        {/* 4 · Resto */}
        <View style={styles.margen}>
          {trip.consejos.length > 0 ? (
            <Card variant="nota" style={styles.seccion}>
              <CardKicker color="brassText">Notas de ruta</CardKicker>
              <View style={styles.lista}>
                {trip.consejos.map((c) => (
                  <Txt key={c} variant="bodyS">
                    · {c}
                  </Txt>
                ))}
              </View>
            </Card>
          ) : null}

          {pendientes.length > 0 ? (
            <Card style={styles.seccion}>
              <CardKicker>Para tu próxima visita</CardKicker>
              <View style={styles.lista}>
                {pendientes.map((a) => (
                  <Txt key={a.id} variant="bodyS">
                    · {a.nombre}
                  </Txt>
                ))}
              </View>
            </Card>
          ) : null}

          <View style={styles.seccionGrande}>
            <TripEssentials trip={trip} moneda={moneda} tripId={tripId} />
          </View>

          <View style={styles.seccionGrande}>
            <RealSearch
              destino={trip.destino}
              origen={trip.origen}
              fechaInicio={trip.fechaInicio}
              fechaFin={trip.fechaFin}
              personas={trip.personas}
              moneda={moneda}
            />
          </View>
        </View>
      </ScrollView>

      {/* Barra de edición o FAB «Ajustar con IA» */}
      {editing ? (
        <View
          style={[styles.barra, { paddingBottom: Math.max(12, insets.bottom) }]}
        >
          <Button
            title="Cancelar"
            variant="outline"
            onPress={cancelarEdicion}
          />
          <Button
            title="Guardar cambios"
            variant="tinta"
            loading={guardando}
            loadingText="Guardando…"
            onPress={() => void saveEditing()}
            style={styles.flexBoton}
          />
        </View>
      ) : esDueno ? (
        <View
          style={[styles.fab, { bottom: 16 + insets.bottom }]}
          pointerEvents="box-none"
        >
          <Button
            title="Ajustar con IA"
            variant="tinta"
            size="lg"
            icon={Compass}
            onPress={() => setSheet('ajustar')}
            style={styles.fabBoton}
          />
        </View>
      ) : null}

      {/* Ajustar con IA */}
      <Sheet
        visible={sheet === 'ajustar'}
        onClose={() => setSheet(null)}
        title="Ajustar con IA"
        description="Dile a Wayio qué cambiar y reescribe tu itinerario."
      >
        <AdjustChat
          trip={trip}
          onAdjusted={handleAdjusted}
          {...(anterior
            ? {
                onUndo: () => {
                  setSheet(null)
                  restaurar(anterior)
                },
              }
            : {})}
          onEditarAMano={() => {
            setSheet(null)
            startEditing()
          }}
          onVerPlanes={() => {
            setSheet(null)
            navigate({ name: 'paywall' })
          }}
        />
      </Sheet>

      {/* Compartir */}
      <Sheet
        visible={sheet === 'compartir'}
        onClose={() => setSheet(null)}
        title="Compartir"
      >
        {/* Un miembro solo puede pasar la vista si el dueño ya la publicó:
            si no, el enlace llevaría a «Este viaje ya no se comparte». */}
        {esDueno || esPublico ? (
          <OpcionSheet
            icono={Link2}
            titulo="Vista de solo lectura"
            detalle={
              esDueno
                ? 'Un enlace para que cualquiera vea el plan, sin editar.'
                : 'Comparte el enlace del plan.'
            }
            onPress={() => void compartirVista()}
          />
        ) : null}
        {!esDueno && !esPublico && !row?.grupo_link ? (
          <Txt variant="bodyS" color="fgMuted">
            Quien creó el viaje todavía no lo ha compartido.
          </Txt>
        ) : null}
        {row?.grupo_link ? (
          <OpcionSheet
            icono={UserPlus}
            titulo="Invitar a la sala del grupo"
            detalle="Chat, votos y gastos compartidos con tus acompañantes."
            onPress={() => void invitar()}
          />
        ) : null}
        {esDueno && esPublico ? (
          <Button
            title="Dejar de compartir la vista"
            variant="ghost"
            size="sm"
            onPress={() => void dejarDeCompartir()}
            style={styles.hueco}
          />
        ) : null}
      </Sheet>

      {/* Más */}
      <Sheet
        visible={sheet === 'mas'}
        onClose={() => setSheet(null)}
        title="Más opciones"
      >
        <OpcionSheet
          icono={MessagesSquare}
          titulo="Sala del grupo"
          detalle="Chat, votos y gastos del viaje."
          onPress={() => {
            setSheet(null)
            navigate({ name: 'group', trip, tripId })
          }}
        />
        {esDueno ? (
          <Button
            title="Eliminar viaje"
            variant="danger-outline"
            icon={Trash2}
            fullWidth
            onPress={() => {
              setSheet(null)
              setTimeout(() => setBorrarViaje(true), ESPERA_MODAL)
            }}
            style={styles.huecoGrande}
          />
        ) : null}
      </Sheet>

      {/* Reagendar: ¿Te la perdiste? → Buscando → Sugerencia */}
      <Sheet
        visible={reagendar !== null}
        onClose={cerrarReagendar}
        title={
          reagendar?.paso === 'sugerencia'
            ? 'Nueva hora sugerida'
            : reagendar?.paso === 'buscando'
              ? 'Buscando nueva hora…'
              : reagendar?.paso === 'error'
                ? reagendar.requierePro && reagendar.huecos.length > 0
                  ? 'Elige el nuevo horario'
                  : 'No encontramos hueco'
                : '¿Te la perdiste?'
        }
        {...(reagendar ? { description: reagendar.actividad.nombre } : {})}
      >
        {reagendar?.paso === 'pregunta' ? (
          <View style={styles.pasos}>
            <Txt variant="bodyS" color="fgMuted">
              La marcamos como perdida y buscamos otro momento del viaje para
              hacerla.
            </Txt>
            <Button
              title="Sí, buscar nueva hora"
              variant="tinta"
              fullWidth
              onPress={() => void confirmarPerdida(true)}
            />
            <Button
              title="Solo marcarla como perdida"
              variant="outline"
              fullWidth
              onPress={() => void confirmarPerdida(false)}
            />
          </View>
        ) : null}
        {reagendar?.paso === 'buscando' ? (
          <View style={styles.buscando} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.fg} />
            <Txt variant="bodyS" color="fgMuted">
              La IA revisa los huecos libres de tu itinerario…
            </Txt>
          </View>
        ) : null}
        {reagendar?.paso === 'sugerencia' ? (
          <View style={styles.pasos}>
            <Card style={styles.sugerencia}>
              <Txt
                variant="overline"
                style={{ color: colorDia(days, reagendar.resultado.dia) }}
              >
                Día {String(reagendar.resultado.dia).padStart(2, '0')}
              </Txt>
              <Txt variant="title" tnum>
                {formatHora12(reagendar.resultado.activity.horaInicio)} –{' '}
                {formatHora12(reagendar.resultado.activity.horaFin)}
              </Txt>
              {reagendar.resultado.nota ? (
                <Txt variant="bodyS" color="fgMuted" style={styles.hueco}>
                  {reagendar.resultado.nota}
                </Txt>
              ) : null}
            </Card>
            <View style={styles.fila}>
              <Button
                title="Descartar"
                variant="ghost"
                onPress={() => setReagendar(null)}
              />
              <Button
                title="Aceptar"
                variant="tinta"
                onPress={() =>
                  aceptarSugerencia(reagendar.actividad, reagendar.resultado)
                }
                style={styles.flexBoton}
              />
            </View>
          </View>
        ) : null}
        {reagendar?.paso === 'error' ? (
          <View style={styles.pasos}>
            <Callout tone={reagendar.requierePro ? 'info' : 'warning'}>
              {reagendar.mensaje}
            </Callout>
            {reagendar.requierePro ? (
              <Txt variant="caption" color="fgMuted">
                {TEXTO_REAGENDAR_PRO}
              </Txt>
            ) : null}
            {reagendar.huecos.length > 0 ? (
              <>
                <Txt variant="label">Huecos libres: elige uno</Txt>
                {reagendar.huecos.slice(0, 6).map((h) => (
                  <Pressable
                    key={`${h.dia}-${h.desde}`}
                    onPress={() => elegirHueco(reagendar.actividad, h)}
                    accessibilityRole="button"
                    accessibilityLabel={`Día ${h.dia}, de ${formatHora12(h.desde)} a ${formatHora12(h.hasta)}`}
                    style={({ pressed }) => [
                      styles.hueco2,
                      pressed ? { backgroundColor: colors.surface2 } : null,
                    ]}
                  >
                    <Badge label={`Día ${h.dia}`} variant="brand" />
                    <Txt variant="bodyS" tnum>
                      {formatHora12(h.desde)} – {formatHora12(h.hasta)}
                    </Txt>
                  </Pressable>
                ))}
              </>
            ) : null}
            <Button
              title="Dejarla para después"
              variant="outline"
              fullWidth
              onPress={() => setReagendar(null)}
            />
          </View>
        ) : null}
      </Sheet>

      <ConfirmDialog
        visible={borrarViaje}
        onClose={() => setBorrarViaje(false)}
        title="¿Eliminar este viaje?"
        description="Se borra el itinerario, el chat y los gastos del grupo. No se puede deshacer."
        confirmLabel="Eliminar viaje"
        loadingLabel="Eliminando…"
        onConfirm={async () => {
          try {
            await deleteTrip(tripId)
            toast.success('Viaje eliminado')
            reset({ name: 'home' })
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : 'No pudimos borrar el viaje.'
            )
            throw e
          }
        }}
      />

      <ConfirmDialog
        visible={descartar}
        onClose={() => setDescartar(false)}
        tone="neutral"
        title="¿Descartar los cambios?"
        description="Lo que editaste no se guardará."
        confirmLabel="Descartar"
        cancelLabel="Seguir editando"
        onConfirm={() => setEditing(false)}
      />
    </Pantalla>
  )
}

function ChipDia({
  etiqueta,
  detalle,
  color,
  accesible,
  seleccionado,
  onPress,
}: {
  etiqueta: string
  detalle?: string
  color?: string
  accesible?: string
  seleccionado: boolean
  onPress: () => void
}): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: seleccionado }}
      accessibilityLabel={`${accesible ?? etiqueta}${detalle ? `, ${detalle}` : ''}`}
      style={[styles.chip, seleccionado ? styles.chipSel : null]}
    >
      {color ? (
        <View style={[styles.chipPunto, { backgroundColor: color }]} />
      ) : null}
      <Txt variant="label" tnum color={seleccionado ? 'fgInverse' : 'fg'}>
        {etiqueta}
      </Txt>
      {detalle ? (
        <Txt variant="caption" color={seleccionado ? 'fgInverse' : 'fgSubtle'}>
          {detalle}
        </Txt>
      ) : null}
    </Pressable>
  )
}

function OpcionSheet({
  icono: Icono,
  titulo,
  detalle,
  onPress,
}: {
  icono: typeof Link2
  titulo: string
  detalle: string
  onPress: () => void
}): React.ReactElement {
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint={detalle}
      style={({ pressed }) => [
        styles.opcion,
        pressed ? { backgroundColor: colors.surface2 } : null,
      ]}
    >
      <View style={[styles.opcionIcono, { backgroundColor: colors.surface2 }]}>
        <Icono
          size={20}
          color={colors.fg}
          strokeWidth={1.75}
          accessible={false}
        />
      </View>
      <View style={styles.flex}>
        <Txt variant="label">{titulo}</Txt>
        <Txt variant="caption" color="fgMuted">
          {detalle}
        </Txt>
      </View>
    </Pressable>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    flex: { flex: 1 },
    flexBoton: { flex: 1 },
    margen: { paddingHorizontal: 16 },
    hueco: { marginTop: 8 },
    huecoGrande: { marginTop: 20 },
    esqueletoFila: { flexDirection: 'row', gap: 16, marginTop: 20 },
    h1: { marginTop: 6 },
    meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sellos: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
    },
    guardando: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    faltan: { marginTop: 16 },
    resumen: { marginTop: 14 },
    vivo: { marginTop: 20 },
    acciones: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 10,
    },
    seccion: { marginTop: 20 },
    seccionGrande: { marginTop: 40 },
    aviso: { marginTop: 10 },
    revisar: { marginTop: 12, marginLeft: -12 },
    lista: { gap: 6, marginTop: 6 },
    chipsBarra: {
      marginTop: 20,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    chips: { paddingHorizontal: 16, gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surface,
    },
    chipSel: {
      backgroundColor: t.colors.surfaceInverse,
      borderColor: t.colors.surfaceInverse,
    },
    chipPunto: { width: 8, height: 8, borderRadius: 4 },
    barra: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: t.colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    fab: { position: 'absolute', right: 16 },
    fabBoton: { ...t.elevation.float },
    pasos: { gap: 12 },
    buscando: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
    },
    sugerencia: { padding: 16 },
    fila: { flexDirection: 'row', gap: 12 },
    hueco2: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 48,
      paddingHorizontal: 12,
      borderRadius: t.radius.control,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
    },
    opcion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 64,
      paddingHorizontal: 8,
      borderRadius: t.radius.control,
    },
    opcionIcono: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
