import { useEffect, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { useEstilos, useTheme, type Tema } from '../../theme'
import { Txt } from '../ui/Txt'
import { Button } from '../ui/Button'
import { Clock } from '../ui/iconos'
import { useReduceMotion } from '../ui/useReduceMotion'

interface Props {
  retrasoMinutos: number
  actividadNombre?: string | null
  /** «Mover a otro día»: la marca como perdida y busca un hueco. */
  onMover: () => void
  onIgnorar: () => void
}

/**
 * Nivel 2: tarjeta inferior (no bloquea la pantalla). Se coloca dentro del
 * área de contenido, encima de la barra inferior.
 */
export function AlertLevel2({
  retrasoMinutos,
  actividadNombre,
  onMover,
  onIgnorar,
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  const reducir = useReduceMotion()
  const [valor] = useState(() => new Animated.Value(0))

  useEffect(() => {
    const anim = Animated.spring(valor, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 260,
      damping: 30,
    })
    anim.start()
    return () => anim.stop()
  }, [valor])

  const salir = (cb: () => void): void => {
    Animated.timing(valor, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => cb())
  }

  const translateY = valor.interpolate({
    inputRange: [0, 1],
    outputRange: [reducir ? 0 : 40, 0],
  })

  return (
    <Animated.View
      style={[styles.card, { opacity: valor, transform: [{ translateY }] }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.cabecera}>
        <Clock
          size={20}
          color={colors.warningFg}
          strokeWidth={1.75}
          accessible={false}
        />
        <Txt variant="title" style={styles.titulo}>
          Llevas {retrasoMinutos} min de retraso
        </Txt>
      </View>
      <Txt variant="bodyS" color="fgMuted">
        {actividadNombre
          ? `Puede que no llegues a todo hoy. ¿Movemos ${actividadNombre} o sigues igual?`
          : 'Puede que no llegues a todo hoy. ¿La movemos o sigues igual?'}
      </Txt>
      <View style={styles.botones}>
        {/* Dice exactamente lo que hace: la marca como perdida y busca hueco. */}
        <Button
          title="Mover a otro día"
          variant="tinta"
          onPress={() => salir(onMover)}
          style={styles.boton}
        />
        <Button
          title="Seguir igual"
          variant="ghost"
          onPress={() => salir(onIgnorar)}
          style={styles.boton}
        />
      </View>
    </Animated.View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    card: {
      position: 'absolute',
      left: t.space[3],
      right: t.space[3],
      bottom: t.space[3],
      backgroundColor: t.isDark ? t.colors.surfaceRaised : t.colors.surface,
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: t.space[5],
      gap: t.space[2],
      ...(t.isDark ? {} : t.elevation.float),
    },
    cabecera: { flexDirection: 'row', alignItems: 'center', gap: t.space[2] },
    titulo: { flex: 1 },
    botones: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.space[2],
      marginTop: t.space[2],
    },
    boton: { flexGrow: 1 },
  })
