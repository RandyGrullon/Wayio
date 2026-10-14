import { useCallback, useEffect, useState } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as SystemUI from 'expo-system-ui'
import * as Notifications from 'expo-notifications'
import { useFonts } from 'expo-font'
import { Newsreader_500Medium } from '@expo-google-fonts/newsreader/500Medium'
import { Newsreader_500Medium_Italic } from '@expo-google-fonts/newsreader/500Medium_Italic'
import { Newsreader_600SemiBold } from '@expo-google-fonts/newsreader/600SemiBold'
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular'
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium'
import { InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans/600SemiBold'
import { InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans/700Bold'
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium'
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context'
import './src/tasks/backgroundLocation'
import { AuthProvider } from './src/context/AuthContext'
import { NavigationProvider } from './src/navigation/NavigationContext'
import { RootNavigator } from './src/navigation/RootNavigator'
import { AtrasAndroid, EnlacesProfundos } from './src/navigation/Enlaces'
import { ErrorBoundary } from './src/components/ErrorBoundary'
import { ErrorGlobal } from './src/components/ErrorGlobal'
import { ToastProvider } from './src/components/ui/Toast'
import { IntroSplash } from './src/components/brand/IntroSplash'
import { setIntroActiva } from './src/components/brand/introEstado'
import { ThemeProvider, useTheme, useThemePreference } from './src/theme'

// El splash nativo (solo el punto) se queda hasta que las fuentes estén listas
// y la intro haya pintado su primer fotograma, idéntico al splash (§9.9).
SplashScreen.preventAutoHideAsync().catch(() => undefined)
try {
  SplashScreen.setOptions({ fade: false, duration: 0 })
} catch {
  // Opciones no disponibles en esta plataforma.
}

// Notificaciones locales del modo en vivo (M22): banner + lista, sin la
// opción obsoleta `shouldShowAlert`.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

/** Fuentes del sistema (ver `fonts` en theme.ts). */
const FUENTES_APP = {
  Newsreader_500Medium,
  Newsreader_500Medium_Italic,
  Newsreader_600SemiBold,
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
  GeistMono_500Medium,
}

type Arranque = 'decidiendo' | 'intro' | 'lista'

function ocultarSplash(): void {
  SplashScreen.hideAsync().catch(() => undefined)
}

/** Barra de estado y fondo de la ventana según el tema. */
function BarrasDelSistema(): React.ReactElement {
  const { isDark, colors } = useTheme()
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => undefined)
  }, [colors.bg])
  return <StatusBar style={isDark ? 'light' : 'dark'} />
}

function Contenido(): React.ReactElement | null {
  const [fuentesListas, errorFuentes] = useFonts(FUENTES_APP)
  const { listo: temaListo } = useThemePreference()
  const { colors } = useTheme()
  const [arranque, setArranque] = useState<Arranque>('decidiendo')
  const listas = (fuentesListas || errorFuentes !== null) && temaListo

  // ¿Intro o no? Solo en arranque en frío; nunca con movimiento reducido ni
  // con lector de pantalla (§9.9.5).
  useEffect(() => {
    if (!listas) return
    let vivo = true
    Promise.all([
      AccessibilityInfo.isReduceMotionEnabled(),
      AccessibilityInfo.isScreenReaderEnabled(),
    ])
      .then(([reducir, lector]) => {
        if (!vivo) return
        if (reducir || lector) {
          setArranque('lista')
          ocultarSplash()
        } else {
          setIntroActiva(true)
          setArranque('intro')
        }
      })
      .catch(() => {
        if (!vivo) return
        setArranque('lista')
        ocultarSplash()
      })
    return () => {
      vivo = false
    }
  }, [listas])

  // Salvavidas: el splash nativo nunca se queda fijo más de 6 s.
  useEffect(() => {
    const id = setTimeout(ocultarSplash, 6000)
    return () => clearTimeout(id)
  }, [])

  const terminarIntro = useCallback(() => setArranque('lista'), [])
  // Si la intro falla al pintar, la app sigue: se oculta el splash, el logo
  // real vuelve a verse y el overlay se desmonta.
  const introFallida = useCallback(() => {
    setIntroActiva(false)
    ocultarSplash()
    setArranque('lista')
  }, [])

  if (!listas) return null

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <BarrasDelSistema />
      <ErrorBoundary
        fallback={(reintentar) => <ErrorGlobal onRetry={reintentar} />}
      >
        <AuthProvider>
          <NavigationProvider>
            <ToastProvider>
              <AtrasAndroid />
              <EnlacesProfundos />
              <RootNavigator />
            </ToastProvider>
          </NavigationProvider>
        </AuthProvider>
      </ErrorBoundary>
      {arranque === 'intro' ? (
        <ErrorBoundary fallback={null} onError={introFallida}>
          <IntroSplash onListo={ocultarSplash} onTerminar={terminarIntro} />
        </ErrorBoundary>
      ) : null}
    </View>
  )
}

export default function App(): React.ReactElement {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <Contenido />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({ flex: { flex: 1 } })
