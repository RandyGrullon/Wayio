import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native'
import { colors } from '../theme'

const STEPS = [
  { msg: 'Buscando vuelos desde tu ciudad...', icon: '✈️', ms: 2000 },
  { msg: 'Encontrando los mejores hoteles...', icon: '🏨', ms: 2000 },
  { msg: 'Descubriendo actividades increíbles...', icon: '🗺️', ms: 2000 },
  {
    msg: 'La IA está armando 3 versiones de tu viaje...',
    icon: '🤖',
    ms: 3000,
  },
  { msg: 'Optimizando rutas para no perder tiempo...', icon: '📍', ms: 1000 },
] as const

export function LoadingScreen(): React.ReactElement {
  const [step, setStep] = useState(0)

  useEffect(() => {
    let current = 0
    let timer: ReturnType<typeof setTimeout>
    const advance = (): void => {
      if (current < STEPS.length - 1) {
        current += 1
        setStep(current)
        timer = setTimeout(advance, STEPS[current]?.ms ?? 2000)
      }
    }
    timer = setTimeout(advance, STEPS[0]?.ms ?? 2000)
    return () => clearTimeout(timer)
  }, [])

  const current = STEPS[step]
  const pct = ((step + 1) / STEPS.length) * 100

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Text style={styles.icon}>{current?.icon ?? '✈️'}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.msg}>{current?.msg ?? ''}</Text>
        <Text style={styles.sub}>Generando 3 paquetes en paralelo...</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primaryLight },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  icon: { fontSize: 64, marginBottom: 24 },
  barTrack: {
    width: 240,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#BFDBFE',
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 999, backgroundColor: colors.primary },
  msg: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginTop: 18,
    textAlign: 'center',
  },
  sub: { fontSize: 13, color: colors.textFaint, marginTop: 8 },
})
