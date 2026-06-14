import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '../../theme'
import { useNavigation } from '../../navigation/NavigationContext'

interface Props {
  title: string
  subtitle?: string
  right?: React.ReactNode
}

export function ScreenHeader({
  title,
  subtitle,
  right,
}: Props): React.ReactElement {
  const { canGoBack, goBack } = useNavigation()
  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {canGoBack ? (
          <TouchableOpacity onPress={goBack} hitSlop={12} style={styles.back}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  back: { marginRight: 8, paddingRight: 4 },
  backText: { fontSize: 30, color: colors.primary, lineHeight: 32 },
  titles: { flex: 1 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  right: { marginLeft: 8 },
})
