import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useNavigation, type Entrada, type Route } from './NavigationContext'
import { AuthScreen } from '../screens/AuthScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { CreateTripScreen } from '../screens/CreateTripScreen'
import { RecreateTripScreen } from '../screens/RecreateTripScreen'
import { PackagesScreen } from '../screens/PackagesScreen'
import { TripDetailScreen } from '../screens/TripDetailScreen'
import { GroupScreen } from '../screens/GroupScreen'
import { JoinGroupScreen } from '../screens/JoinGroupScreen'
import { PaywallScreen } from '../screens/PaywallScreen'
import { useTheme } from '../theme'
import { useReduceMotion } from '../components/ui/useReduceMotion'

// Lazy-loaded so the native Mapbox module (`@rnmapbox/maps`, pulled in via
// MapScreen) is only evaluated when the live-tracking screen is actually opened.
// This lets the app boot in Expo Go / web (which lack the native module); only
// the map screen needs a dev build.
const LiveTrackingScreen = lazy(() =>
  import('../screens/LiveTrackingScreen').then((m) => ({
    default: m.LiveTrackingScreen,
  }))
)

function Cargando(): React.ReactElement {
  const { colors } = useTheme()
  return (
    <View
      style={[styles.centro, { backgroundColor: colors.bg }]}
      accessible
      accessibilityLabel="Cargando…"
    >
      <ActivityIndicator color={colors.fg} />
    </View>
  )
}

function pantalla(route: Route): ReactNode {
  switch (route.name) {
    case 'create':
      return (
        <CreateTripScreen
          {...(route.initialDestino
            ? { initialDestino: route.initialDestino }
            : {})}
          {...(route.descripcion ? { descripcion: route.descripcion } : {})}
          {...(route.lugaresDeseados
            ? { lugaresDeseados: route.lugaresDeseados }
            : {})}
          {...(route.initialForm ? { initialForm: route.initialForm } : {})}
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
        <Suspense fallback={<Cargando />}>
          <LiveTrackingScreen
            trip={route.trip}
            {...(route.tripId ? { tripId: route.tripId } : {})}
          />
        </Suspense>
      )
    case 'group':
      return (
        <GroupScreen
          tripId={route.tripId}
          {...(route.trip ? { trip: route.trip } : {})}
        />
      )
    case 'unirse':
      return <JoinGroupScreen link={route.link} />
    case 'paywall':
      return <PaywallScreen />
    case 'home':
    default:
      return <HomeScreen />
  }
}

/**
 * Pantalla de la pila. Las de abajo siguen montadas (conservan su estado al
 * volver) pero ocultas. La que queda arriba entra con un desplazamiento corto
 * en la dirección de la navegación (§7.3); con movimiento reducido, fundido.
 */
function Escena({
  activa,
  direccion,
  primera,
  children,
}: {
  activa: boolean
  direccion: 1 | -1
  primera: boolean
  children: ReactNode
}): React.ReactElement {
  const { motion } = useTheme()
  const reducir = useReduceMotion()
  const [p] = useState(() => new Animated.Value(primera ? 1 : 0))
  const montada = useRef(false)

  useEffect(() => {
    if (!activa) return
    if (!montada.current && primera) {
      montada.current = true
      return
    }
    montada.current = true
    p.setValue(0)
    Animated.timing(p, {
      toValue: 1,
      duration: reducir ? 120 : motion.medium,
      easing: motion.easing.papel,
      useNativeDriver: true,
    }).start()
  }, [activa, p, reducir, primera, motion.medium, motion.easing.papel])

  const desplazamiento = reducir ? 0 : 28 * direccion
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        activa ? null : styles.oculta,
        {
          opacity: p,
          transform: [
            {
              translateX: p.interpolate({
                inputRange: [0, 1],
                outputRange: [desplazamiento, 0],
              }),
            },
          ],
        },
      ]}
      importantForAccessibility={activa ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!activa}
    >
      {children}
    </Animated.View>
  )
}

export function RootNavigator(): React.ReactElement {
  const { user, loading } = useAuth()
  const { stack, direccion, reset } = useNavigation()
  const { colors } = useTheme()
  const uid = user?.id ?? null
  const uidPrevio = useRef<string | null>(uid)

  // Al cerrar sesión (o cambiar de cuenta) la pila vuelve a Inicio.
  useEffect(() => {
    if (uidPrevio.current !== null && uidPrevio.current !== uid) {
      reset({ name: 'home' })
    }
    uidPrevio.current = uid
  }, [uid, reset])

  if (loading) return <Cargando />
  if (!user) return <AuthScreen />

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      {stack.map((e: Entrada, i) => (
        <Escena
          key={e.key}
          activa={i === stack.length - 1}
          direccion={direccion}
          primera={i === 0}
        >
          {pantalla(e.route)}
        </Escena>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  oculta: { display: 'none' },
})
