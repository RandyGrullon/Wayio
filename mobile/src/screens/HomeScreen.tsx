import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useNavigation } from '../navigation/NavigationContext'
import { listTrips } from '../lib/trips/repository'
import { Button } from '../components/ui/Button'
import { colors, radius } from '../theme'
import { formatCurrency } from '../lib/utils/format'
import type { TripRow } from '../types/planning'

export function HomeScreen(): React.ReactElement {
  const { user, tier, signOut } = useAuth()
  const { navigate } = useNavigation()
  const [trips, setTrips] = useState<TripRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const rows = await listTrips()
      setTrips(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando viajes')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  const greeting =
    (user?.user_metadata?.['full_name'] as string | undefined) ??
    user?.email ??
    'Viajero'

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>Wayio</Text>
          <Text style={styles.hi}>Hola, {greeting}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => navigate({ name: 'paywall' })}
            style={[styles.tierPill, tier !== 'free' && styles.tierPillPro]}
          >
            <Text
              style={[styles.tierText, tier !== 'free' && styles.tierTextPro]}
            >
              {tier === 'free' ? 'Free' : tier === 'grupo' ? 'Grupo' : 'Pro'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void signOut()} hitSlop={8}>
            <Text style={styles.signout}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                void load()
              }}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <Button
              title="+ Nuevo viaje"
              onPress={() => navigate({ name: 'create' })}
              size="lg"
              style={styles.newBtn}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Aún no tienes viajes</Text>
              <Text style={styles.emptyText}>
                {error ?? 'Crea tu primer itinerario con IA.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const t = item.data
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigate({ name: 'trip', tripId: item.id })}
                style={styles.tripCard}
              >
                <View style={styles.flex}>
                  <Text style={styles.tripDest}>{t.destino}</Text>
                  <Text style={styles.tripMeta}>
                    {t.personas} pers · {t.fechaInicio} → {t.fechaFin}
                  </Text>
                  <View style={styles.tripTags}>
                    <Text style={styles.tripTag}>{t.paquete}</Text>
                    <Text style={styles.tripBudget}>
                      {formatCurrency(t.presupuestoTotal)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  logo: { fontSize: 26, fontWeight: '800', color: colors.text },
  hi: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tierPill: {
    backgroundColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tierPillPro: { backgroundColor: colors.indigo },
  tierText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  tierTextPro: { color: '#FFFFFF' },
  signout: { fontSize: 13, color: colors.textFaint },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 20, paddingTop: 4 },
  newBtn: { marginBottom: 16 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  flex: { flex: 1 },
  tripDest: { fontSize: 17, fontWeight: '700', color: colors.text },
  tripMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  tripTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  tripTag: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  tripBudget: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  chevron: { fontSize: 28, color: colors.textFaint, marginLeft: 8 },
})
