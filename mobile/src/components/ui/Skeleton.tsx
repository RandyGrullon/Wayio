import { useEffect, useState, type ReactNode } from 'react'
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useTheme } from '../../theme'
import { useReduceMotion } from './useReduceMotion'

/**
 * Bloque de carga (§5.9). Late suave mientras carga de verdad; con movimiento
 * reducido es estático.
 */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 4,
  style,
}: {
  width?: DimensionValue
  height?: DimensionValue
  radius?: number
  style?: StyleProp<ViewStyle>
}): React.ReactElement {
  const { colors } = useTheme()
  const reducir = useReduceMotion()
  const [pulso] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (reducir) {
      pulso.setValue(0)
      return
    }
    const bucle = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulso, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    )
    bucle.start()
    return () => bucle.stop()
  }, [pulso, reducir])

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.surface2,
          opacity: pulso.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.55],
          }),
        },
        style,
      ]}
    />
  )
}

/**
 * Región de carga: se anuncia una vez («Cargando…») y oculta los bloques a
 * los lectores de pantalla.
 */
export function SkeletonRegion({
  label = 'Cargando…',
  children,
  style,
}: {
  label?: string
  children: ReactNode
  style?: StyleProp<ViewStyle>
}): React.ReactElement {
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={style}
    >
      <View importantForAccessibility="no-hide-descendants">{children}</View>
    </View>
  )
}

/** Tarjeta de viaje en carga (Mis viajes). */
export function SkeletonTarjeta(): React.ReactElement {
  const { colors } = useTheme()
  return (
    <View
      style={[
        styles.tarjeta,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Skeleton width="40%" height={12} />
      <Skeleton width="70%" height={22} style={styles.hueco} />
      <Skeleton width="55%" height={12} style={styles.hueco} />
    </View>
  )
}

const styles = StyleSheet.create({
  tarjeta: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
  },
  hueco: { marginTop: 12 },
})
