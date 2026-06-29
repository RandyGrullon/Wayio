import { useEffect, useState } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { colors } from '../../theme'

interface Props {
  /** Emoji shown on the spinning coin (✈️ 🏨 🚗 …). */
  icon: string
  size?: number
}

/**
 * A Wayio-branded "coin" that rotates continuously in 3D (rotateY + perspective)
 * behind a steady icon. When `icon` changes — e.g. flights → hotels → cars — the
 * icon hands off with a 3D pop (flip + scale), so each loading phase transitions
 * smoothly. Pure `Animated`, runs on the native driver, no extra deps.
 */
export function Loader3D({ icon, size = 112 }: Props): React.ReactElement {
  const [spin] = useState(() => new Animated.Value(0))
  const [pop] = useState(() => new Animated.Value(1))

  // Continuous 3D rotation of the coin.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [spin])

  // 3D pop whenever the icon changes.
  useEffect(() => {
    pop.setValue(0)
    Animated.spring(pop, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start()
  }, [icon, pop])

  const rotateY = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })
  const popScale = pop.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  })
  const popRotate = pop.interpolate({
    inputRange: [0, 1],
    outputRange: ['-90deg', '0deg'],
  })

  return (
    <View style={[styles.stage, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.coin,
          {
            width: size,
            height: size,
            borderRadius: size * 0.3,
            transform: [{ perspective: 800 }, { rotateY }],
          },
        ]}
      />
      <Animated.Text
        style={[
          styles.icon,
          {
            fontSize: size * 0.42,
            transform: [
              { perspective: 800 },
              { rotateY: popRotate },
              { scale: popScale },
            ],
          },
        ]}
      >
        {icon}
      </Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center' },
  coin: {
    position: 'absolute',
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  icon: { textAlign: 'center' },
})
