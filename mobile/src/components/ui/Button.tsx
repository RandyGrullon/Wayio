import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { colors, radius } from '../../theme'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props {
  title: string
  onPress: () => void
  variant?: Variant
  size?: Size
  disabled?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
}: Props): React.ReactElement {
  const v = VARIANTS[variant]
  const s = SIZES[size]
  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border },
        s.container,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={v.text} style={styles.spin} />
        ) : null}
        <Text style={[styles.text, { color: v.text, fontSize: s.font }]}>
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

const VARIANTS: Record<Variant, { bg: string; border: string; text: string }> =
  {
    primary: { bg: colors.primary, border: colors.primary, text: '#FFFFFF' },
    secondary: { bg: colors.surface, border: colors.border, text: colors.text },
    ghost: { bg: 'transparent', border: 'transparent', text: colors.primary },
    danger: { bg: colors.red, border: colors.red, text: '#FFFFFF' },
  }

const SIZES: Record<Size, { container: ViewStyle; font: number }> = {
  sm: { container: { paddingVertical: 8, paddingHorizontal: 12 }, font: 13 },
  md: { container: { paddingVertical: 12, paddingHorizontal: 16 }, font: 15 },
  lg: { container: { paddingVertical: 16, paddingHorizontal: 20 }, font: 17 },
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  spin: { marginRight: 8 },
  text: { fontWeight: '600' },
  disabled: { opacity: 0.55 },
})
