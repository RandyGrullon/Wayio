import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
} from 'react-native'

interface Option {
  label: string
  sublabel: string
  onPress: () => void
}

interface Props {
  retrasoMinutos: number
  opciones: [Option, Option, Option]
}

export function AlertLevel4({
  retrasoMinutos,
  opciones,
}: Props): React.ReactElement {
  const [scale] = useState(() => new Animated.Value(0.9))

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start()
  }, [scale])

  return (
    <Animated.View style={[styles.screen, { transform: [{ scale }] }]}>
      <SafeAreaView style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.badge}>⚠️ URGENTE</Text>
          <Text style={styles.title}>{retrasoMinutos} minutos de retraso</Text>
          <Text style={styles.subtitle}>
            Elige cómo seguir — no puedes continuar sin decidir
          </Text>
        </View>

        <View style={styles.options}>
          {opciones.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.optionBtn, i === 0 && styles.optionBtnPrimary]}
              onPress={opt.onPress}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.optionLabel,
                  i === 0 && styles.optionLabelPrimary,
                ]}
              >
                {String.fromCharCode(65 + i)}. {opt.label}
              </Text>
              <Text
                style={[
                  styles.optionSublabel,
                  i === 0 && styles.optionSublabelPrimary,
                ]}
              >
                {opt.sublabel}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#92400E',
    zIndex: 999,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: { marginBottom: 40, alignItems: 'center' },
  badge: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FCD34D',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#FDE68A',
    textAlign: 'center',
    lineHeight: 22,
  },
  options: { gap: 14 },
  optionBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  optionBtnPrimary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  optionLabelPrimary: { color: '#92400E' },
  optionSublabel: { fontSize: 13, color: '#FDE68A' },
  optionSublabelPrimary: { color: '#B45309' },
})
