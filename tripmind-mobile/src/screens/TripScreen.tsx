import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native'
import * as Notifications from 'expo-notifications'
import { ActivityCard } from '../components/ActivityCard'
import { OfflineIndicator } from '../components/OfflineIndicator'
import { MapScreen } from './MapScreen'
import { useLocation } from '../hooks/useLocation'
import { useGeofencing } from '../hooks/useGeofencing'
import { useOfflineSync } from '../hooks/useOfflineSync'
import {
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../tasks/backgroundLocation'
import { loadTrip, loadActiveTripId } from '../lib/offline'
import type { Trip } from '../types/trip'
import type { Activity } from '../types/activity'

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

export function TripScreen(): React.ReactElement {
  const [trip, setTrip] = useState<Trip | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('map')
  const [gpsEnabled, setGpsEnabled] = useState(false)

  const { location, isTracking } = useLocation()
  const offlineSync = useOfflineSync()

  const tripActivities: Activity[] =
    trip?.dias.flatMap((d) => d.actividades) ?? []
  const { activities, recentEvents } = useGeofencing(
    location,
    trip?.id ?? '',
    tripActivities
  )

  useEffect(() => {
    void (async () => {
      await Notifications.requestPermissionsAsync()
      const id = await loadActiveTripId()
      if (!id) return
      const loaded = await loadTrip(id)
      setTrip(loaded)
    })()
  }, [])

  const toggleGps = async (): Promise<void> => {
    if (gpsEnabled) {
      await stopBackgroundTracking()
    } else {
      await startBackgroundTracking()
    }
    setGpsEnabled((prev) => !prev)
  }

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
        <View>
          <Text style={styles.title}>{trip.destino}</Text>
          <Text style={styles.subtitle}>
            {trip.dias.length} días · {activities.length} actividades
          </Text>
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
        <MapScreen
          activities={activities}
          userLocation={location}
          isCrucero={trip.isCrucero}
        />
      ) : (
        <ScrollView style={styles.list}>
          {activities.map((activity, i) => (
            <ActivityCard key={activity.id} activity={activity} index={i} />
          ))}
          <View style={styles.listBottom} />
        </ScrollView>
      )}
    </SafeAreaView>
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
})
