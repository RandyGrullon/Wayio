import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors, radius } from '../../theme'

export function Card({
  children,
  style,
}: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}): React.ReactElement {
  return <View style={[styles.card, style]}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
})
