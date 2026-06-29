import { lazy, Suspense } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useNavigation } from './NavigationContext'
import { AuthScreen } from '../screens/AuthScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { CreateTripScreen } from '../screens/CreateTripScreen'
import { RecreateTripScreen } from '../screens/RecreateTripScreen'
import { PackagesScreen } from '../screens/PackagesScreen'
import { TripDetailScreen } from '../screens/TripDetailScreen'
import { GroupScreen } from '../screens/GroupScreen'
import { PaywallScreen } from '../screens/PaywallScreen'
import { colors } from '../theme'

// Lazy-loaded so the native Mapbox module (`@rnmapbox/maps`, pulled in via
// MapScreen) is only evaluated when the live-tracking screen is actually opened.
// This lets the app boot in Expo Go / web (which lack the native module); only
// the map screen needs a dev build.
const LiveTrackingScreen = lazy(() =>
  import('../screens/LiveTrackingScreen').then((m) => ({
    default: m.LiveTrackingScreen,
  }))
)

export function RootNavigator(): React.ReactElement {
  const { user, loading } = useAuth()
  const { route } = useNavigation()

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  if (!user) return <AuthScreen />

  switch (route.name) {
    case 'create':
      return (
        <CreateTripScreen
          {...(route.initialDestino
            ? { initialDestino: route.initialDestino }
            : {})}
        />
      )
    case 'recreate':
      return <RecreateTripScreen />
    case 'packages':
      return <PackagesScreen result={route.result} form={route.form} />
    case 'trip':
      return <TripDetailScreen tripId={route.tripId} />
    case 'live':
      return (
        <Suspense
          fallback={
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          }
        >
          <LiveTrackingScreen trip={route.trip} />
        </Suspense>
      )
    case 'group':
      return <GroupScreen trip={route.trip} tripId={route.tripId} />
    case 'paywall':
      return <PaywallScreen />
    case 'home':
    default:
      return <HomeScreen />
  }
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
})
