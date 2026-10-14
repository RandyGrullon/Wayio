import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native'
import { useEstilos, useTheme, type Tema } from '../../../theme'
import { Txt } from '../../ui/Txt'
import type { LucideIcon } from '../../ui/iconos'
import { useReduceMotion } from '../../ui/useReduceMotion'

export interface MensajeToast {
  /** Cambia en cada mensaje nuevo (reinicia el temporizador). */
  id: string
  texto: string
  icon: LucideIcon
  tono?: 'normal' | 'aviso'
}

const VISIBLE_MS = 4500

/**
 * Toast del modo en vivo (§5.8): tinta invertida, abajo al centro a 16 px de
 * la barra inferior, se anuncia al lector de pantalla y se va solo. No
 * captura toques (no tapa los botones de debajo). Un mensaje a la vez.
 */
export function ToastVivo({
  mensaje,
}: {
  mensaje: MensajeToast | null
}): React.ReactElement | null {
  const [visible, setVisible] = useState<MensajeToast | null>(null)
  const [opacidad] = useState(() => new Animated.Value(0))
  const reducir = useReduceMotion()
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()

  useEffect(() => {
    if (!mensaje) return
    const entrada = setTimeout(() => {
      setVisible(mensaje)
      AccessibilityInfo.announceForAccessibility(mensaje.texto)
      Animated.timing(opacidad, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }, 0)
    const salida = setTimeout(() => {
      Animated.timing(opacidad, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setVisible(null)
      })
    }, VISIBLE_MS)
    return () => {
      clearTimeout(entrada)
      clearTimeout(salida)
    }
  }, [mensaje, opacidad])

  if (!visible) return null
  const Icono = visible.icon
  const translateY = opacidad.interpolate({
    inputRange: [0, 1],
    outputRange: [reducir ? 0 : 12, 0],
  })

  return (
    <View style={styles.capa} pointerEvents="none">
      <Animated.View
        style={[
          styles.toast,
          { opacity: opacidad, transform: [{ translateY }] },
        ]}
        accessibilityLiveRegion="polite"
      >
        <Icono
          size={18}
          color={
            visible.tono === 'aviso' ? colors.toastAction : colors.toastSuccess
          }
          strokeWidth={1.75}
          accessible={false}
        />
        <Txt variant="label" color="fgInverse" style={styles.texto}>
          {visible.texto}
        </Txt>
      </Animated.View>
    </View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    capa: {
      position: 'absolute',
      bottom: t.space[4],
      left: t.space.gutter,
      right: t.space.gutter,
      alignItems: 'center',
      zIndex: 10,
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space[2],
      backgroundColor: t.colors.surfaceInverse,
      borderRadius: t.radius.control,
      paddingHorizontal: t.space[4],
      paddingVertical: t.space[3],
      maxWidth: 400,
      ...(t.isDark ? {} : t.elevation.float),
    },
    texto: { flexShrink: 1 },
  })
