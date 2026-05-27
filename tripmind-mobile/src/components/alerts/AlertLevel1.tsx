import { useEffect, useState } from 'react'
import { Animated, Text, StyleSheet } from 'react-native'

interface Props {
  onDismiss: () => void
}

export function AlertLevel1({ onDismiss }: Props): React.ReactElement {
  const [opacity] = useState(() => new Animated.Value(1))

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(onDismiss)
    }, 5000)
    return () => clearTimeout(timer)
  }, [opacity, onDismiss])

  return (
    <Animated.View style={[styles.banner, { opacity }]}>
      <Text style={styles.text}>
        Vas un poco justo de tiempo, no hay urgencia.
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  text: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '500',
  },
})
