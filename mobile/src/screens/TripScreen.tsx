import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import * as Notifications from 'expo-notifications'
import { ActivityCard } from '../components/ActivityCard'
import { OfflineIndicator } from '../components/OfflineIndicator'
import { AlertOverlay } from '../components/alerts/AlertOverlay'
import { ReschedulePanel } from '../components/ReschedulePanel'
import { ErrorBoundary } from '../components/ErrorBoundary'

// Lazy so the native Mapbox module is only evaluated when the map tab is opened
// on a dev build. In Expo Go (no native module) the ErrorBoundary shows a hint.
const MapScreen = lazy(() =>
  import('./MapScreen').then((m) => ({ default: m.MapScreen }))
)
import { useLocation } from '../hooks/useLocation'
import { useGeofencing } from '../hooks/useGeofencing'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useAlertEngine } from '../hooks/useAlertEngine'
import {
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../tasks/backgroundLocation'
import {
  loadTrip,
  loadActiveTripId,
  saveTrip,
  saveActiveTripId,
} from '../lib/offline'
import type { Trip } from '../types/trip'
import type { Activity } from '../types/activity'
import type { RescheduleOption } from '../types/alert'
import type { UserLocation } from '../types/geofencing'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

type Tab = 'map' | 'list'

interface TripScreenProps {
  trip?: Trip
  onExit?: () => void
}

export function TripScreen({
  trip: tripProp,
  onExit,
}: TripScreenProps = {}): React.ReactElement {
  const [trip, setTrip] = useState<Trip | null>(tripProp ?? null)
  const [activeTab, setActiveTab] = useState<Tab>('map')
  const [gpsEnabled, setGpsEnabled] = useState(false)
  const [reschedulingActivity, setReschedulingActivity] =
    useState<Activity | null>(null)

  const { location, isTracking } = useLocation()
  const offlineSync = useOfflineSync()
  // Dev-only: fake "arriving" at an activity to test geofencing/alerts in Expo
  // Go without real GPS movement. Overrides the live location when set.
  const [simulated, setSimulated] = useState<UserLocation | null>(null)
  const effectiveLocation = simulated ?? location

  const tripActivities: Activity[] =
    trip?.dias.flatMap((d) => d.actividades) ?? []

  const { activities, recentEvents } = useGeofencing(
    effectiveLocation,
    trip?.id ?? '',
    tripActivities
  )

  const { alertState, dismiss } = useAlertEngine(
    trip?.dias ?? [],
    trip?.isCrucero === true
  )

  useEffect(() => {
    void (async () => {
      await Notifications.requestPermissionsAsync()
      if (tripProp) {
        await saveTrip(tripProp)
        await saveActiveTripId(tripProp.id)
        setTrip(tripProp)
        return
      }
      const id = await loadActiveTripId()
      if (!id) return
      const loaded = await loadTrip(id)
      setTrip(loaded)
    })()
  }, [tripProp])

  const toggleGps = async (): Promise<void> => {
    if (gpsEnabled) {
      await stopBackgroundTracking()
    } else {
      await startBackgroundTracking()
    }
    setGpsEnabled((prev) => !prev)
  }

  const handleElegirOpcion = useCallback(
    (opcion: 'A' | 'B' | 'C') => {
      if (opcion === 'A' && alertState.actividadActualId) {
        const actividadPerdida = activities.find(
          (a) => a.id === alertState.actividadActualId
        )
        if (actividadPerdida) setReschedulingActivity(actividadPerdida)
      }
      dismiss()
    },
    [alertState.actividadActualId, activities, dismiss]
  )

  const handleAceptarRecomendacion = useCallback((actividadId: string) => {
    setTrip((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        dias: prev.dias.map((d) => ({
          ...d,
          actividades: d.actividades.map((a) =>
            a.id === actividadId ? { ...a, estado: 'perdida' as const } : a
          ),
        })),
      }
    })
  }, [])

  const handleReschedule = useCallback(
    (option: RescheduleOption) => {
      if (!reschedulingActivity || !trip) return

      setTrip((prev) => {
        if (!prev) return prev
        const act: Activity = {
          ...reschedulingActivity,
          estado: 'pendiente' as const,
          diaIndex: option.dia,
        }

        return {
          ...prev,
          dias: prev.dias.map((d) => {
            if (d.index !== option.dia) return d
            const nuevas = [...d.actividades]
            nuevas.splice(option.posicion, 0, act)
            return { ...d, actividades: nuevas }
          }),
        }
      })

      setReschedulingActivity(null)
    },
    [reschedulingActivity, trip]
  )

  const actividadActual =
    activities.find((a) => a.id === alertState.actividadActualId) ?? null
  const puertoCrucero = activities.find((a) => a.puertoCrucero === true) ?? null

  if (!trip) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyText}>No hay viaje cargado</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <OfflineIndicator
        isOnline={offlineSync.isOnline}
        pendingCount={offlineSync.pendingCount}
        syncNow={offlineSync.syncNow}
      />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onExit ? (
            <TouchableOpacity onPress={onExit} hitSlop={12} style={styles.back}>
              <Text style={styles.backText}>‹</Text>
            </TouchableOpacity>
          ) : null}
          <View>
            <Text style={styles.title}>{trip.destino}</Text>
            <Text style={styles.subtitle}>
              {trip.dias.length} días · {activities.length} actividades
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.gpsBtn, gpsEnabled && styles.gpsBtnActive]}
          onPress={() => void toggleGps()}
        >
          <Text style={styles.gpsBtnText}>
            {gpsEnabled ? '📍 GPS on' : '📍 GPS off'}
          </Text>
        </TouchableOpacity>
      </View>

      {isTracking && (
        <View style={styles.trackingBadge}>
          <Text style={styles.trackingText}>
            ● Rastreando ubicación en vivo
          </Text>
        </View>
      )}

      {recentEvents.length > 0 && (
        <View style={styles.eventsBar}>
          <Text style={styles.eventsText}>
            {recentEvents[0]?.type === 'enter' ? '📍' : '✅'}{' '}
            {recentEvents[0]?.activityNombre}
          </Text>
        </View>
      )}

      <View style={styles.tabs}>
        {(['map', 'list'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab === 'map' ? '🗺 Mapa' : '📋 Lista'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'map' ? (
        <ErrorBoundary fallback={<MapUnavailable />}>
          <Suspense
            fallback={
              <View style={styles.mapLoading}>
                <ActivityIndicator color="#2563EB" />
              </View>
            }
          >
            <MapScreen
              activities={activities}
              userLocation={effectiveLocation}
              isCrucero={trip.isCrucero}
            />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <ScrollView style={styles.list}>
          {__DEV__ ? (
            <SimulatePanel
              activities={tripActivities}
              simulating={simulated !== null}
              onSimulate={(a) =>
                setSimulated({
                  lat: a.lat,
                  lng: a.lng,
                  accuracy: 5,
                  timestamp: new Date(),
                })
              }
              onClear={() => setSimulated(null)}
            />
          ) : null}
          {activities.map((activity, i) => (
            <ActivityCard key={activity.id} activity={activity} index={i} />
          ))}
          <View style={styles.listBottom} />
        </ScrollView>
      )}

      <AlertOverlay
        alertState={alertState}
        actividadActual={actividadActual}
        puertoCrucero={puertoCrucero}
        onDismiss={dismiss}
        onAceptarRecomendacion={handleAceptarRecomendacion}
        onElegirOpcion={handleElegirOpcion}
      />

      <Modal
        visible={reschedulingActivity !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setReschedulingActivity(null)}
      >
        <View style={styles.rescheduleOverlay}>
          {reschedulingActivity !== null && (
            <ReschedulePanel
              actividadPerdida={reschedulingActivity}
              itinerarioCompleto={trip.dias}
              onReschedule={handleReschedule}
              onClose={() => setReschedulingActivity(null)}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  )
}

/** Shown in Expo Go where the native map can't load. */
function MapUnavailable(): React.ReactElement {
  return (
    <View style={styles.mapUnavailable}>
      <Text style={styles.mapUnavailableEmoji}>🗺️</Text>
      <Text style={styles.mapUnavailableTitle}>
        El mapa en vivo necesita un dev build
      </Text>
      <Text style={styles.mapUnavailableText}>
        (emulador Android o EAS). El seguimiento por GPS y las alertas funcionan
        igual — usa la pestaña Lista.
      </Text>
    </View>
  )
}

/**
 * Dev-only helper: tap an activity to fake "arriving" there, which fires the
 * geofence enter event and its alert — lets you test live tracking in Expo Go
 * without moving (or a Tokyo trip).
 */
function SimulatePanel({
  activities,
  simulating,
  onSimulate,
  onClear,
}: {
  activities: Activity[]
  simulating: boolean
  onSimulate: (a: Activity) => void
  onClear: () => void
}): React.ReactElement {
  const located = activities.filter((a) => a.lat !== 0 || a.lng !== 0)
  return (
    <View style={styles.simPanel}>
      <View style={styles.simHeader}>
        <Text style={styles.simTitle}>🧪 Simular ubicación (dev)</Text>
        {simulating ? (
          <TouchableOpacity onPress={onClear} hitSlop={6}>
            <Text style={styles.simClear}>Usar GPS real</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.simHint}>
        Toca una actividad para fingir que llegas y disparar el geofencing.
      </Text>
      <View style={styles.simChips}>
        {located.length === 0 ? (
          <Text style={styles.simEmpty}>
            Las actividades aún no tienen coordenadas.
          </Text>
        ) : (
          located.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.simChip}
              onPress={() => onSimulate(a)}
            >
              <Text style={styles.simChipText}>📍 {a.nombre}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#6B7280' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  back: { marginRight: 6, paddingRight: 2 },
  backText: { fontSize: 30, color: '#2563EB', lineHeight: 32 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  gpsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  gpsBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  gpsBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  trackingBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  trackingText: { fontSize: 12, color: '#2563EB', fontWeight: '500' },
  eventsBar: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#DCFCE7',
  },
  eventsText: { fontSize: 13, color: '#15803D', fontWeight: '500' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#2563EB' },
  tabText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  tabTextActive: { color: '#2563EB', fontWeight: '700' },
  list: { flex: 1 },
  listBottom: { height: 24 },
  mapLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapUnavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 6,
  },
  mapUnavailableEmoji: { fontSize: 44 },
  mapUnavailableTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  mapUnavailableText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
  },
  simPanel: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    margin: 12,
  },
  simHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  simTitle: { fontSize: 13, fontWeight: '700', color: '#1E3A8A' },
  simClear: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
  simHint: { fontSize: 12, color: '#3B5BA5', marginTop: 2, marginBottom: 8 },
  simChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  simEmpty: { fontSize: 12, color: '#6B7280' },
  simChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  simChipText: { fontSize: 12, color: '#1D4ED8', fontWeight: '600' },
  rescheduleOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
})
