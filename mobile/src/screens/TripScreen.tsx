import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import { config } from '../config'
import { colorDia, useEstilos, useTheme, type Tema } from '../theme'
import { Txt } from '../components/ui/Txt'
import { Button } from '../components/ui/Button'
import { IconButton } from '../components/ui/IconButton'
import { Card, CardKicker } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton, SkeletonRegion } from '../components/ui/Skeleton'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Info,
  MapPin,
  Ship,
  SkipForward,
  AlertTriangle,
} from '../components/ui/iconos'
import {
  formatActividades,
  formatDias,
  formatFaltan,
  formatFecha,
  formatHora12,
  formatRangoFechas,
} from '../components/ui/formato'
import { ErrorBoundary } from '../components/ErrorBoundary'
import {
  AlertOverlay,
  type OpcionAlerta,
} from '../components/alerts/AlertOverlay'
import {
  ReschedulePanel,
  type PropuestaReagendar,
} from '../components/ReschedulePanel'
import { Aviso, Sello } from '../components/alerts/piezas'
import { useAhora } from '../components/alerts/useAhora'
import { TarjetaAhora } from '../components/alerts/vivo/TarjetaAhora'
import { FilaActividad } from '../components/alerts/vivo/FilaActividad'
import { PillGps } from '../components/alerts/vivo/PillGps'
import { AvisoConexion } from '../components/alerts/vivo/AvisoConexion'
import {
  BarraInferior,
  type PestanaVivo,
} from '../components/alerts/vivo/BarraInferior'
import { MapaNoDisponible } from '../components/alerts/vivo/MapaNoDisponible'
import {
  ToastVivo,
  type MensajeToast,
} from '../components/alerts/vivo/ToastVivo'
import { PanelSimulacion } from '../components/alerts/vivo/PanelSimulacion'
import { useLocation } from '../hooks/useLocation'
import { useGeofencing } from '../hooks/useGeofencing'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useAlertEngine } from '../hooks/useAlertEngine'
import {
  isBackgroundTrackingActive,
  startBackgroundTracking,
  stopBackgroundTracking,
  type ResultadoRastreo,
} from '../tasks/backgroundLocation'
import { pedirPermisoNotificaciones } from '../tasks/notificaciones'
import {
  aISO,
  fechaDeDia,
  faseDelViaje,
  ordenarPorHora,
} from '../lib/geofencing/fechas'
import { actividadesDeHoy, momentoDelDia } from '../lib/geofencing/alertEngine'
import { buscarActividad } from '../lib/geofencing/liveTrip'
import { abrirComoLlegar } from '../lib/geofencing/navegacion'
import {
  eliminarDePendientes,
  guardarEnPendientes,
} from '../lib/scheduling/pendientes'
import {
  hapticConfirmar,
  hapticLlegada,
  hapticSeleccion,
} from '../lib/haptics/patterns'
import type { Trip } from '../types/trip'
import type { Activity } from '../types/activity'
import type { UserLocation } from '../types/geofencing'

// Lazy: el módulo nativo de Mapbox solo se evalúa al abrir la pestaña Mapa
// (en Expo Go no existe y el ErrorBoundary muestra el estado vacío).
const MapScreen = lazy(() =>
  import('./MapScreen').then((m) => ({ default: m.MapScreen }))
)

/** Decisión del viajero que conviene guardar también en la nube. */
export interface CambioEnVivo {
  trip: Trip
  motivo: 'perdida' | 'saltada' | 'reagendada' | 'recomendacion'
  actividadId: string
}

interface TripScreenProps {
  trip?: Trip
  onExit?: () => void
  /** Título de cada día (índice 0-based), p. ej. «Zona Colonial». */
  titulosDias?: readonly string[]
  /** id de la fila del viaje (trips.id): habilita reagendar con IA. */
  filaId?: string
  /** «Para tu próxima visita» que ya traía el viaje (actividadesPendientes). */
  proximaVisita?: readonly { id: string; nombre: string }[]
  /**
   * Guarda en el viaje (Supabase) lo que decide el viajero. Devuelve un
   * mensaje amable si no se pudo (el cambio sigue en el teléfono) o null.
   */
  onPersistir?: (cambio: CambioEnVivo) => Promise<string | null>
}

interface Foco {
  id: string
  lat: number
  lng: number
  nombre: string
}

interface Toast extends MensajeToast {
  creado: number
}

/** Lo que tarda en cerrarse un Modal en iOS antes de poder abrir otro. */
const ESPERA_MODAL_IOS_MS = 450

export function TripScreen({
  trip: tripProp,
  onExit,
  titulosDias,
  filaId,
  proximaVisita,
  onPersistir,
}: TripScreenProps = {}): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors, days } = useTheme()
  const ahora = useAhora(30_000)

  const [tab, setTab] = useState<PestanaVivo>('hoy')
  const [gpsDeseado, setGpsDeseado] = useState(false)
  const [rastreo, setRastreo] = useState<ResultadoRastreo | null>(null)
  const [simulada, setSimulada] = useState<UserLocation | null>(null)
  const [diaForzado, setDiaForzado] = useState<number | null>(null)
  const [reagendo, setReagendo] = useState<{
    actividad: Activity
    saltar: boolean
  } | null>(null)
  const [foco, setFoco] = useState<Foco | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  // ── GPS honesto: solo durante el viaje (o sin fechas / día simulado) ──
  const faseProp = useMemo(
    () => (tripProp ? faseDelViaje(tripProp.dias, ahora) : null),
    [tripProp, ahora]
  )
  const permiteGps =
    diaForzado !== null ||
    faseProp === null ||
    faseProp.tipo === 'durante' ||
    faseProp.tipo === 'sin_fechas'
  const gpsActivo = gpsDeseado && permiteGps
  const loc = useLocation(gpsActivo)
  const ubicacion = simulada ?? loc.location

  // ── Única fuente de verdad del estado de las actividades ──
  const geo = useGeofencing(ubicacion, tripProp ?? null, { diaForzado })
  const { trip, marcarPerdida, reagendar, quitarRecomendada } = geo
  const offline = useOfflineSync()

  /** Con un día simulado, ese día pasa a ser «hoy» para todo el motor. */
  const diasMotor = useMemo(() => {
    if (!trip) return []
    if (diaForzado === null) return trip.dias
    const hoyISO = aISO(ahora)
    return trip.dias.map((d) => ({
      ...d,
      fecha: d.index === diaForzado ? hoyISO : '',
    }))
  }, [trip, diaForzado, ahora])

  const fase = useMemo(() => faseDelViaje(diasMotor, ahora), [diasMotor, ahora])
  const hoy = useMemo(
    () => actividadesDeHoy(diasMotor, ahora),
    [diasMotor, ahora]
  )
  const momento = useMemo(
    () => (hoy ? momentoDelDia(hoy.actividades, ahora) : null),
    [hoy, ahora]
  )

  const conUbicacion = simulada !== null || loc.estado === 'activa'
  const alertas = useAlertEngine(diasMotor, trip?.isCrucero === true, {
    conUbicacion,
  })

  // ── Efectos ──
  useEffect(() => {
    void pedirPermisoNotificaciones()
  }, [])

  // Estado REAL del rastreo en segundo plano. Fuera de las fechas del viaje
  // se para: no se gasta batería cuando ya no sirve.
  useEffect(() => {
    let vivo = true
    void isBackgroundTrackingActive().then((activo) => {
      if (!vivo || !activo) return
      if (permiteGps) {
        setGpsDeseado(true)
        setRastreo('activo')
      } else {
        void stopBackgroundTracking()
      }
    })
    return () => {
      vivo = false
    }
  }, [permiteGps])

  // Llegadas detectadas: háptico suave.
  const ultimoEvento = geo.recentEvents[0] ?? null
  useEffect(() => {
    if (ultimoEvento?.type === 'enter') void hapticLlegada()
  }, [ultimoEvento])

  // Decisiones del viajero → también al viaje en la nube (si se puede).
  const tripRef = useRef<Trip | null>(null)
  const decision = useRef<Omit<CambioEnVivo, 'trip'> | null>(null)

  const mostrar = useCallback(
    (texto: string, icon: MensajeToast['icon'], tono?: 'aviso') => {
      setToast({
        id: `${Date.now()}`,
        creado: Date.now(),
        texto,
        icon,
        ...(tono ? { tono } : {}),
      })
    },
    []
  )

  const persistir = useCallback(
    async (cambio: CambioEnVivo) => {
      if (!onPersistir) return
      try {
        const error = await onPersistir(cambio)
        if (error) {
          mostrar(`Guardado solo en este teléfono. ${error}`, Info, 'aviso')
        }
      } catch {
        mostrar(
          'Guardado solo en este teléfono. No pudimos subirlo a tu viaje.',
          Info,
          'aviso'
        )
      }
    },
    [onPersistir, mostrar]
  )

  useEffect(() => {
    tripRef.current = trip
    const d = decision.current
    if (!d || !trip) return
    decision.current = null
    void persistir({ ...d, trip })
  }, [trip, persistir])

  // El permiso «Siempre» se pide DESPUÉS del de primer plano (Android no
  // admite dos peticiones a la vez): cuando llega la primera posición.
  const pidiendoRastreo = useRef(false)
  const gpsActivoRef = useRef(gpsActivo)
  useEffect(() => {
    gpsActivoRef.current = gpsActivo
  }, [gpsActivo])
  useEffect(() => {
    if (!gpsActivo || loc.estado !== 'activa' || rastreo !== null) return
    if (pidiendoRastreo.current) return
    pidiendoRastreo.current = true
    void startBackgroundTracking().then((r) => {
      pidiendoRastreo.current = false
      // Se apagó mientras se pedía el permiso: no dejarlo encendido.
      if (!gpsActivoRef.current) {
        void stopBackgroundTracking()
        return
      }
      setRastreo(r)
    })
  }, [gpsActivo, loc.estado, rastreo])

  // ── Acciones ──
  const activarGps = useCallback(() => {
    void hapticSeleccion()
    setGpsDeseado(true)
  }, [])

  const apagarGps = useCallback(() => {
    setGpsDeseado(false)
    setRastreo(null)
    void stopBackgroundTracking()
  }, [])

  const { estado: estadoGps, puedePedirPermiso, reintentar } = loc
  const pulsarPill = useCallback(() => {
    if (simulada) {
      setSimulada(null)
      return
    }
    switch (estadoGps) {
      case 'inactiva':
        activarGps()
        break
      case 'activa':
        apagarGps()
        break
      case 'denegada':
        if (puedePedirPermiso) reintentar()
        else void Linking.openSettings()
        break
      case 'apagada':
        if (Platform.OS === 'android') {
          void Location.enableNetworkProviderAsync()
            .then(reintentar)
            .catch(() => Linking.openSettings())
        } else {
          void Linking.openSettings()
        }
        break
      case 'error':
        reintentar()
        break
      default:
        break
    }
  }, [
    simulada,
    estadoGps,
    puedePedirPermiso,
    reintentar,
    activarGps,
    apagarGps,
  ])

  const saltar = useCallback(
    (act: Activity) => {
      marcarPerdida(act.id)
      decision.current = { motivo: 'saltada', actividadId: act.id }
      void guardarEnPendientes(act).catch(() => undefined)
      void hapticConfirmar()
      mostrar(
        `Saltamos ${act.nombre}. Quedó en «Para tu próxima visita».`,
        SkipForward
      )
    },
    [marcarPerdida, mostrar]
  )

  const actividadAlerta = useMemo(
    () =>
      alertas.alertState.actividadActualId
        ? (geo.activities.find(
            (a) => a.id === alertas.alertState.actividadActualId
          ) ?? null)
        : null,
    [alertas.alertState.actividadActualId, geo.activities]
  )

  const recomendada = useMemo(() => {
    const ref = alertas.alertState.aiMessage?.actividadRecomendarQuitar
    if (!ref || !trip) return null
    const a = buscarActividad(trip, ref)
    return a && a.estado === 'pendiente' ? a : null
  }, [alertas.alertState.aiMessage, trip])

  // iOS no presenta un Modal mientras otro se está cerrando (la alerta de
  // nivel 3 o 4): la hoja de reagendar espera a que termine de irse.
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (espera.current) clearTimeout(espera.current)
    },
    []
  )
  const abrirReagendarTrasAlerta = useCallback((actividad: Activity) => {
    if (espera.current) clearTimeout(espera.current)
    const abrir = (): void => setReagendo({ actividad, saltar: true })
    if (Platform.OS === 'ios') {
      espera.current = setTimeout(abrir, ESPERA_MODAL_IOS_MS)
    } else {
      abrir()
    }
  }, [])

  const { dismiss, omitir } = alertas
  const elegirOpcion = useCallback(
    (op: OpcionAlerta) => {
      const act = actividadAlerta
      dismiss()
      if (!act) return
      if (op === 'A') {
        // Elegir «Mover a otro día» ya equivale a confirmar que se la pierde.
        marcarPerdida(act.id)
        abrirReagendarTrasAlerta({ ...act, estado: 'perdida' })
      } else if (op === 'B') saltar(act)
      else omitir(act.id)
    },
    [
      actividadAlerta,
      dismiss,
      omitir,
      saltar,
      marcarPerdida,
      abrirReagendarTrasAlerta,
    ]
  )

  const aceptarRecomendacion = useCallback(
    (id: string) => {
      const quitada = quitarRecomendada(id)
      if (!quitada) return
      decision.current = { motivo: 'recomendacion', actividadId: quitada.id }
      void guardarEnPendientes(quitada).catch(() => undefined)
      void hapticConfirmar()
      mostrar(
        `Quitamos ${quitada.nombre} de hoy. Quedó en «Para tu próxima visita».`,
        Check
      )
    },
    [quitarRecomendada, mostrar]
  )

  const verPuerto = useCallback(() => {
    const e = alertas.embarque
    if (e)
      setFoco({ id: e.actividadId, lat: e.lat, lng: e.lng, nombre: e.nombre })
    setTab('mapa')
    dismiss()
  }, [alertas.embarque, dismiss])

  const confirmarPerdida = useCallback(
    (act: Activity) => {
      if (act.estado !== 'perdida') marcarPerdida(act.id)
    },
    [marcarPerdida]
  )

  const aceptarReagendado = useCallback(
    (act: Activity, p: PropuestaReagendar) => {
      reagendar(act.id, p.dia, {
        horaInicio: p.horaInicio,
        horaFin: p.horaFin,
        ...(p.posicion !== undefined ? { posicion: p.posicion } : {}),
      })
      decision.current = { motivo: 'reagendada', actividadId: act.id }
      void eliminarDePendientes(act.id).catch(() => undefined)
      setReagendo(null)
      mostrar(
        `Movimos ${act.nombre} al día ${p.dia + 1}, ${formatHora12(p.horaInicio)}.`,
        CalendarDays
      )
    },
    [reagendar, mostrar]
  )

  const descartarReagendado = useCallback(
    (act: Activity) => {
      setReagendo(null)
      void guardarEnPendientes(act).catch(() => undefined)
      const actual = tripRef.current
      if (actual) {
        void persistir({ trip: actual, motivo: 'perdida', actividadId: act.id })
      }
      mostrar(`Guardamos ${act.nombre} para tu próxima visita.`, Check)
    },
    [persistir, mostrar]
  )

  const cambiarTab = useCallback((p: PestanaVivo) => {
    void hapticSeleccion()
    if (p === 'mapa') setFoco(null)
    setTab(p)
  }, [])

  // Toast: el más reciente entre una llegada detectada y un mensaje propio.
  const mensajeToast = useMemo<MensajeToast | null>(() => {
    const evento: Toast | null = ultimoEvento
      ? {
          id: `${ultimoEvento.activityId}-${ultimoEvento.type}-${ultimoEvento.timestamp.getTime()}`,
          creado: ultimoEvento.timestamp.getTime(),
          texto:
            ultimoEvento.type === 'enter'
              ? `Llegaste a ${ultimoEvento.activityNombre}`
              : `Terminaste ${ultimoEvento.activityNombre}`,
          icon: ultimoEvento.type === 'enter' ? MapPin : CheckCircle2,
        }
      : null
    if (!evento) return toast
    if (!toast) return evento
    return evento.creado > toast.creado ? evento : toast
  }, [ultimoEvento, toast])

  // ── Render ──
  if (!trip) {
    return tripProp ? (
      // Skeleton de portada y timeline (§6.6) mientras se lee la copia local.
      <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']}>
        <SkeletonRegion label="Preparando tu día…" style={styles.scroll}>
          <View style={styles.esqueleto}>
            <Skeleton width="40%" height={12} />
            <Skeleton width="65%" height={28} radius={6} />
            <Skeleton width="50%" height={12} />
            <Skeleton
              height={200}
              radius={16}
              style={styles.esqueletoTarjeta}
            />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={48} radius={12} />
            ))}
          </View>
        </SkeletonRegion>
      </SafeAreaView>
    ) : (
      <SafeAreaView style={styles.centro} edges={['top', 'bottom']}>
        <EmptyState
          title="No hay ningún viaje en vivo"
          description="Abre un viaje y toca «Modo en vivo»."
          {...(onExit
            ? {
                action: {
                  label: 'Volver',
                  onPress: onExit,
                  variant: 'outline' as const,
                },
              }
            : {})}
        />
      </SafeAreaView>
    )
  }

  const totalDias = trip.dias.length
  const primerDia = trip.dias[0]
  const ultimoDia = trip.dias.at(-1)
  const rangoViaje = formatRangoFechas(
    primerDia ? fechaDeDia(primerDia) : null,
    ultimoDia ? fechaDeDia(ultimoDia) : null
  )
  const mostrarPill =
    diaForzado !== null || fase.tipo === 'durante' || fase.tipo === 'sin_fechas'
  const manana = hoy
    ? (ordenarPorHora(trip.dias[hoy.indice + 1]?.actividades ?? [])[0] ?? null)
    : null
  const completadasHoy =
    hoy?.actividades.filter((a) => a.estado === 'completada').length ?? 0

  const portada = (
    <View style={styles.portada}>
      <Txt
        variant="overline"
        style={
          fase.tipo === 'durante'
            ? { color: colorDia(days, fase.indiceHoy + 1) }
            : null
        }
        color="fgMuted"
      >
        {fase.tipo === 'durante'
          ? `Día ${String(fase.indiceHoy + 1).padStart(2, '0')} de ${String(totalDias).padStart(2, '0')} · ${formatFecha(fase.fecha)}`
          : fase.tipo === 'antes'
            ? 'Tu próximo viaje'
            : fase.tipo === 'despues'
              ? 'Tu viaje'
              : 'En vivo'}
      </Txt>
      <Txt variant="h1">{trip.destino}</Txt>
      {fase.tipo === 'durante' && titulosDias?.[fase.indiceHoy] ? (
        <Txt variant="bodyS" color="fgMuted">
          {titulosDias[fase.indiceHoy]}
        </Txt>
      ) : null}
      <View style={styles.meta}>
        {hoy ? (
          <Txt variant="caption" color="fgMuted">
            {`${formatActividades(hoy.actividades.length)} hoy · ${completadasHoy === 1 ? '1 completada' : `${completadasHoy} completadas`}`}
          </Txt>
        ) : (
          <Txt variant="caption" color="fgMuted">
            {formatDias(totalDias)}
          </Txt>
        )}
        {trip.isCrucero ? (
          <Sello icon={Ship} tono="tinta">
            Crucero
          </Sello>
        ) : null}
      </View>
    </View>
  )

  const avisoConexion = (
    <AvisoConexion
      isOnline={offline.isOnline}
      guardadoEn={geo.guardadoEn}
      pendingCount={offline.pendingCount}
      syncing={offline.syncing}
      onSincronizar={() => void offline.syncNow()}
    />
  )

  const avisoGps =
    gpsActivo && loc.error ? (
      <Aviso
        tono="warning"
        icon={AlertTriangle}
        vivo
        accion={
          loc.estado === 'denegada' && !loc.puedePedirPermiso ? (
            <Button
              title="Abrir ajustes"
              variant="link"
              size="sm"
              onPress={() => void Linking.openSettings()}
            />
          ) : (
            <Button
              title="Reintentar"
              variant="link"
              size="sm"
              onPress={pulsarPill}
            />
          )
        }
      >
        {loc.error}
      </Aviso>
    ) : gpsActivo &&
      loc.estado === 'activa' &&
      rastreo === 'solo_primer_plano' ? (
      <Aviso
        tono="info"
        icon={Info}
        titulo="Solo con la app abierta"
        accion={
          <Button
            title="Abrir ajustes"
            variant="link"
            size="sm"
            onPress={() => void Linking.openSettings()}
          />
        }
      >
        Para detectar tus llegadas con Wayio cerrada, permite la ubicación
        «Siempre».
      </Aviso>
    ) : gpsActivo && loc.estado === 'activa' && rastreo === 'no_disponible' ? (
      <Aviso tono="info" icon={Info}>
        Con la app cerrada no podremos detectar tus llegadas. Mantén Wayio
        abierta durante el día.
      </Aviso>
    ) : null

  const vistaHoy = (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {portada}
      {avisoConexion}
      {avisoGps}

      {fase.tipo === 'durante' && hoy && momento ? (
        <>
          <TarjetaAhora
            momento={momento}
            ahora={ahora}
            ubicacion={ubicacion}
            manana={manana}
            onComoLlegar={(a) => abrirComoLlegar(a.lat, a.lng, a.nombre)}
            onMeLaPerdi={(a) => setReagendo({ actividad: a, saltar: false })}
          />
          {!conUbicacion && !gpsActivo ? (
            <Aviso tono="info" icon={Info}>
              Activa la ubicación para que marquemos tus llegadas solas y te
              avisemos si vas tarde.
            </Aviso>
          ) : null}
          <View style={styles.seccion}>
            <Txt variant="overline" color="fgMuted">
              Tu día
            </Txt>
            {hoy.actividades.length === 0 ? (
              <Txt variant="bodyS" color="fgMuted">
                Hoy es un día libre.
              </Txt>
            ) : (
              hoy.actividades.map((a, i) => (
                <FilaActividad
                  key={a.id}
                  actividad={a}
                  moneda={trip.moneda}
                  destacada={a.id === momento.actual?.id}
                  ultima={i === hoy.actividades.length - 1}
                />
              ))
            )}
          </View>
        </>
      ) : null}

      {fase.tipo === 'antes' ? (
        <Card variant="default" style={styles.tarjeta}>
          <CardKicker icon={CalendarDays}>
            {`Empieza el ${formatFecha(fase.inicio)}`}
          </CardKicker>
          <Txt variant="numXL" tnum>
            {formatFaltan(fase.faltan)}
          </Txt>
          <Txt variant="bodyS" color="fgMuted">
            Ese día te diremos qué toca ahora, marcaremos tus llegadas y te
            avisaremos si vas tarde.
          </Txt>
          <Button
            title="Ver itinerario"
            variant="outline"
            onPress={() => cambiarTab('dias')}
          />
        </Card>
      ) : null}

      {fase.tipo === 'despues' ? (
        <Card variant="default" style={styles.tarjeta}>
          <CardKicker icon={CheckCircle2} color="successFg">
            Viaje terminado
          </CardKicker>
          <Txt variant="h2">Bienvenido de vuelta</Txt>
          <Txt variant="bodyS" color="fgMuted">
            Ya no seguimos tu ubicación. Tu itinerario, con lo que hiciste,
            sigue en «Días».
          </Txt>
          <Button
            title="Ver itinerario"
            variant="outline"
            onPress={() => cambiarTab('dias')}
          />
        </Card>
      ) : null}

      {fase.tipo === 'sin_fechas' ? (
        <Aviso tono="info" icon={Info} titulo="Este viaje no tiene fechas">
          Vigilamos todas sus actividades a la vez. Las alertas por retraso
          necesitan las fechas del viaje.
        </Aviso>
      ) : null}

      {__DEV__ ? (
        <PanelSimulacion
          totalDias={totalDias}
          diaForzado={diaForzado}
          actividades={
            hoy?.actividades ?? trip.dias.flatMap((d) => d.actividades)
          }
          simulando={simulada !== null}
          onDia={setDiaForzado}
          onLlegar={(a) =>
            setSimulada({
              lat: a.lat,
              lng: a.lng,
              accuracy: 5,
              timestamp: new Date(),
            })
          }
          onUsarGps={() => setSimulada(null)}
        />
      ) : null}
    </ScrollView>
  )

  // «Para tu próxima visita»: las perdidas del viaje en vivo y las que ya
  // traía el plan (salvo las que han vuelto al itinerario).
  const enViaje = new Map(
    trip.dias.flatMap((d) => d.actividades).map((a) => [a.id, a])
  )
  const perdidas: { id: string; nombre: string }[] = [
    ...[...enViaje.values()].filter((a) => a.estado === 'perdida'),
    ...(proximaVisita ?? []).filter((p) => !enViaje.has(p.id)),
  ]

  const vistaDias = (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.portada}>
        <Txt variant="overline" color="fgMuted">
          Itinerario
        </Txt>
        <Txt variant="h1">{trip.destino}</Txt>
        <Txt variant="caption" color="fgMuted">
          {[formatDias(totalDias), rangoViaje].filter(Boolean).join(' · ')}
        </Txt>
      </View>
      {avisoConexion}
      {trip.dias.map((d) => {
        const fecha = fechaDeDia(d)
        const esHoy = hoy?.indice === d.index
        const ordenadas = ordenarPorHora(d.actividades)
        return (
          <Card key={d.index} variant="default" style={styles.dia}>
            <View style={styles.diaCabecera}>
              <Txt
                variant="overline"
                style={{ color: colorDia(days, d.index + 1) }}
              >
                Día {String(d.index + 1).padStart(2, '0')}
              </Txt>
              {fecha ? (
                <Txt variant="caption" color="fgMuted">
                  {formatFecha(fecha)}
                </Txt>
              ) : null}
              {esHoy ? (
                <Sello tono="tinta" style={styles.empuja}>
                  Hoy
                </Sello>
              ) : null}
            </View>
            {titulosDias?.[d.index] ? (
              <Txt variant="h3">{titulosDias[d.index]}</Txt>
            ) : null}
            {ordenadas.length === 0 ? (
              <Txt variant="bodyS" color="fgMuted">
                Día libre.
              </Txt>
            ) : (
              ordenadas.map((a, i) => (
                <FilaActividad
                  key={a.id}
                  actividad={a}
                  moneda={trip.moneda}
                  ultima={i === ordenadas.length - 1}
                />
              ))
            )}
          </Card>
        )
      })}
      {perdidas.length > 0 ? (
        <Card variant="nota" style={styles.tarjeta}>
          <CardKicker color="brassText">Para tu próxima visita</CardKicker>
          {perdidas.map((a) => (
            <Txt key={a.id} variant="label">
              {a.nombre}
            </Txt>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  )

  const destinoMapa: Foco | null =
    foco ??
    (momento?.actual
      ? {
          id: momento.actual.id,
          lat: momento.actual.lat,
          lng: momento.actual.lng,
          nombre: momento.actual.nombre,
        }
      : null)
  const tramoSiguiente =
    momento?.tipo === 'en_curso' ? momento.siguiente : (momento?.actual ?? null)

  const vistaMapa = !config.mapboxToken ? (
    <MapaNoDisponible destino={destinoMapa} sinToken />
  ) : (
    <ErrorBoundary
      fallback={<MapaNoDisponible destino={destinoMapa} sinToken={false} />}
    >
      <Suspense
        fallback={
          <View style={styles.centroMapa}>
            <ActivityIndicator color={colors.fg} />
          </View>
        }
      >
        <MapScreen
          activities={geo.activities}
          userLocation={ubicacion}
          isCrucero={trip.isCrucero}
          diaActivo={hoy?.indice ?? null}
          foco={foco}
          siguiente={tramoSiguiente}
          moneda={trip.moneda}
        />
      </Suspense>
    </ErrorBoundary>
  )

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <View style={styles.header}>
        {onExit ? (
          <IconButton
            label="Salir del modo en vivo"
            icon={ChevronLeft}
            onPress={onExit}
          />
        ) : null}
        <View style={styles.headerTitulos}>
          <Txt variant="overline" color="fgMuted">
            Modo en vivo
          </Txt>
          <Txt variant="title" numberOfLines={1} accessibilityRole="header">
            {trip.destino}
          </Txt>
        </View>
        {mostrarPill ? (
          <PillGps
            estado={loc.estado}
            simulada={simulada !== null}
            onPress={pulsarPill}
          />
        ) : null}
      </View>

      <View style={styles.contenido}>
        {tab === 'hoy' ? vistaHoy : tab === 'mapa' ? vistaMapa : vistaDias}

        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <AlertOverlay
            alertState={alertas.alertState}
            actividadActual={actividadAlerta}
            embarque={alertas.embarque}
            recomendada={recomendada}
            onDismiss={dismiss}
            onAceptarRecomendacion={aceptarRecomendacion}
            onElegirOpcion={elegirOpcion}
            onVerPuerto={verPuerto}
            onOcultarEmbarque={alertas.ocultarEmbarqueHoy}
          />
        </View>
        <ToastVivo mensaje={mensajeToast} />
      </View>

      <BarraInferior activa={tab} onCambiar={cambiarTab} />

      <ReschedulePanel
        key={
          reagendo
            ? `${reagendo.actividad.id}-${reagendo.saltar ? 'b' : 'c'}`
            : 'cerrado'
        }
        visible={reagendo !== null}
        actividad={reagendo?.actividad ?? null}
        dias={trip.dias}
        filaId={filaId}
        saltarConfirmacion={reagendo?.saltar ?? false}
        onConfirmarPerdida={confirmarPerdida}
        onAceptar={aceptarReagendado}
        onDescartar={descartarReagendado}
        onCerrar={() => setReagendo(null)}
      />
    </SafeAreaView>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: t.colors.bg },
    centro: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.space[3],
      padding: t.space[6],
      backgroundColor: t.colors.bg,
    },
    centroMapa: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space[2],
      paddingLeft: t.space[1],
      paddingRight: t.space.gutter,
      paddingVertical: t.space[2],
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
      backgroundColor: t.colors.bg,
    },
    headerTitulos: { flex: 1, minWidth: 0, paddingLeft: t.space[1] },
    contenido: { flex: 1 },
    // En tablet (768+) la columna no pasa de 720: se lee como un cuaderno.
    scroll: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      paddingHorizontal: t.space.gutter,
      paddingTop: t.space[5],
      paddingBottom: t.space[12],
      gap: t.space[4],
    },
    esqueleto: { gap: t.space[3] },
    esqueletoTarjeta: { marginVertical: t.space[2] },
    portada: { gap: t.space[1] },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: t.space[2],
      marginTop: t.space[1],
    },
    seccion: { gap: t.space[1] },
    tarjeta: { gap: t.space[3] },
    dia: { gap: t.space[2], paddingHorizontal: t.space[3] },
    diaCabecera: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space[2],
      paddingHorizontal: t.space[2],
    },
    empuja: { marginLeft: 'auto' },
  })
