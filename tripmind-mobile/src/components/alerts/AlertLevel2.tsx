import { useState, useEffect } from 'react'
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
} from 'react-native'

const { height } = Dimensions.get('window')

interface Props {
  retrasoMinutos: number
  onVerOpciones: () => void
  onIgnorar: () => void
}

export function AlertLevel2({
  retrasoMinutos,
  onVerOpciones,
  onIgnorar,
}: Props): React.ReactElement {
  const [translateY] = useState(() => new Animated.Value(height))

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
  }, [translateY])

  const dismiss = (cb: () => void): void => {
    Animated.timing(translateY, {
      toValue: height,
      duration: 300,
      useNativeDriver: true,
    }).start(cb)
  }

  return (
    <Animated.View style={[styles.card, { transform: [{ translateY }] }]}>
      <View style={styles.handle} />
      <Text style={styles.title}>⏱ Llevas {retrasoMinutos} min de retraso</Text>
      <Text style={styles.body}>
        Puede que no llegues a todo. ¿Querés ver opciones?
      </Text>
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => dismiss(onVerOpciones)}
        >
          <Text style={styles.btnPrimaryText}>Ver opciones</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => dismiss(onIgnorar)}
        >
          <Text style={styles.btnSecondaryText}>Ignorar</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8 },
  body: { fontSize: 15, color: '#4B5563', marginBottom: 24, lineHeight: 22 },
  buttons: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: '#2563EB' },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  btnSecondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  btnSecondaryText: { color: '#374151', fontSize: 15, fontWeight: '600' },
})
