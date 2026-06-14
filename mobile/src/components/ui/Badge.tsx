import { StyleSheet, Text, View } from 'react-native'
import { radius } from '../../theme'

export function Badge({
  label,
  color,
}: {
  label: string
  color: string
}): React.ReactElement {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}20` }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '600' },
})
