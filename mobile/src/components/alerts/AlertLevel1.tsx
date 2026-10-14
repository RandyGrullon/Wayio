import { useEffect, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { useEstilos, useTheme, type Tema } from '../../theme'
import { Txt } from '../ui/Txt'
import { IconButton } from '../ui/IconButton'
import { Clock, X } from '../ui/iconos'
import { useReduceMotion } from '../ui/useReduceMotion'

interface Props {
  /** Nombre de la actividad a la que vas tarde. */
  actividadNombre?: string | null
  retrasoMinutos: number
  onDismiss: () => void
}

const VISIBLE_MS = 6000

/** Nivel 1: aviso discreto arriba que se va solo (una vez, sin bucles). */
export function AlertLevel1({
  actividadNombre,
  retrasoMinutos,
  onDismiss,
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  const reducir = useReduceMotion()
  const [valor] = useState(() => new Animated.Value(0))

  useEffect(() => {
    Animated.timing(valor, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start()
    const timer = setTimeout(() => {
      Animated.timing(valor, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onDismiss()
      })
    }, VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [valor, onDismiss])

  const translateY = valor.interpolate({
    inputRange: [0, 1],
    outputRange: [reducir ? 0 : -8, 0],
  })

  return (
    <Animated.View
      style={[styles.banner, { opacity: valor, transform: [{ translateY }] }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Clock
        size={18}
        color={colors.warningFg}
        strokeWidth={1.75}
        accessible={false}
      />
      <View style={styles.textos}>
        <Txt variant="label" color="warningFg">
          Vas un poco justo de tiempo
        </Txt>
        <Txt variant="caption" color="warningFg">
          {actividadNombre
            ? `${retrasoMinutos} min tarde para ${actividadNombre}. Sin prisa: aún llegas.`
            : `${retrasoMinutos} min tarde. Sin prisa: aún llegas.`}
        </Txt>
      </View>
      <IconButton
        label="Cerrar aviso"
        icon={X}
        onPress={onDismiss}
        size="sm"
        color={colors.warningFg}
      />
    </Animated.View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space[3],
      backgroundColor: t.colors.warningBg,
      paddingLeft: t.space.gutter,
      paddingRight: t.space[2],
      paddingVertical: t.space[2],
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    textos: { flex: 1 },
  })
