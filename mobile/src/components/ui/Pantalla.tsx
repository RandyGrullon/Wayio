import type { ReactNode } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { useTheme } from '../../theme'

/**
 * Contenedor de pantalla: respeta las áreas seguras (notch, barra de gestos)
 * con react-native-safe-area-context y pinta el fondo de papel / noche.
 */
export function Pantalla({
  children,
  edges = ['top', 'left', 'right'],
  style,
  fondo = 'bg',
}: {
  children: ReactNode
  edges?: readonly Edge[]
  style?: StyleProp<ViewStyle>
  fondo?: 'bg' | 'surface'
}): React.ReactElement {
  const { colors } = useTheme()
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.flex, { backgroundColor: colors[fondo] }, style]}
    >
      {children}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({ flex: { flex: 1 } })
