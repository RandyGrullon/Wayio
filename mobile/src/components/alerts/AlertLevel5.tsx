import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
  Linking,
} from 'react-native'
import { triggerAlertHaptic, stopHaptics } from '../../lib/haptics/patterns'

interface Props {
  puertoCruceroNombre: string
  puertoCruceroLat: number
  puertoCruceroLng: number
  minutosRestantes: number
  onActuar: () => void
}

export function AlertLevel5({
  puertoCruceroNombre,
  puertoCruceroLat,
  puertoCruceroLng,
  minutosRestantes,
  onActuar,
}: Props): React.ReactElement {
  const [blink] = useState(() => new Animated.Value(1))
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blink, {
          toValue: 0.3,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    ).start()

    void triggerAlertHaptic(5)

    intervalRef.current = setInterval(
      () => {
        void triggerAlertHaptic(5)
      },
      5 * 60 * 1000
    )

    return () => {
      blink.stopAnimation()
      stopHaptics()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [blink])

  const navegarAlPuerto = (): void => {
    const url = `https://maps.google.com/?daddr=${puertoCruceroLat},${puertoCruceroLng}&dir_action=navigate`
    void Linking.openURL(url)
    onActuar()
  }

  return (
    <Animated.View style={[styles.screen, { opacity: blink }]}>
      <SafeAreaView style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.sos}>🚨 SOS 🚨</Text>
          <Text style={styles.title}>RIESGO DE PERDER EL BARCO</Text>
          <Text style={styles.minutes}>
            {minutosRestantes} minutos para el embarque
          </Text>
          <Text style={styles.lugar}>{puertoCruceroNombre}</Text>
        </View>

        <TouchableOpacity
          style={styles.cta}
          onPress={navegarAlPuerto}
          activeOpacity={0.9}
        >
          <Text style={styles.ctaText}>NAVEGAR AL PUERTO AHORA</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Esta alerta se repetirá cada 5 minutos hasta que actúes.
        </Text>
      </SafeAreaView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#DC2626',
    zIndex: 1000,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 24,
  },
  header: { alignItems: 'center', gap: 12 },
  sos: { fontSize: 48 },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 1,
  },
  minutes: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FEF2F2',
    textAlign: 'center',
  },
  lugar: {
    fontSize: 16,
    color: '#FECACA',
    fontWeight: '600',
    textAlign: 'center',
  },
  cta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  ctaText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  disclaimer: {
    fontSize: 13,
    color: '#FECACA',
    textAlign: 'center',
    lineHeight: 18,
  },
})
