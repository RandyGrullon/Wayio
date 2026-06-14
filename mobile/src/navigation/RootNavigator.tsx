import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useNavigation } from './NavigationContext'
import { AuthScreen } from '../screens/AuthScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { CreateTripScreen } from '../screens/CreateTripScreen'
import { PackagesScreen } from '../screens/PackagesScreen'
import { TripDetailScreen } from '../screens/TripDetailScreen'
import { LiveTrackingScreen } from '../screens/LiveTrackingScreen'
import { GroupScreen } from '../screens/GroupScreen'
import { PaywallScreen } from '../screens/PaywallScreen'
import { colors } from '../theme'

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
      return <CreateTripScreen />
    case 'packages':
      return <PackagesScreen result={route.result} form={route.form} />
    case 'trip':
      return <TripDetailScreen tripId={route.tripId} />
    case 'live':
      return <LiveTrackingScreen trip={route.trip} />
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
