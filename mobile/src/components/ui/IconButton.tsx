import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { palette, useTheme } from '../../theme'
import type { LucideIcon } from './iconos'

type Variante = 'ghost' | 'outline' | 'soft' | 'primary' | 'tinta'
type Tamano = 'sm' | 'md' | 'lg'

interface Props {
  /** Obligatorio: es lo que oye el lector de pantalla. */
  label: string
  icon: LucideIcon
  onPress: () => void
  variant?: Variante
  size?: Tamano
  disabled?: boolean
  /** Color del icono (token ya resuelto); por defecto el del variant. */
  color?: string
  selected?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityHint?: string
}

const LADO: Record<Tamano, number> = { sm: 36, md: 44, lg: 52 }

/** Botón solo icono (§5.1): siempre con `label` accesible. */
export function IconButton({
  label,
  icon: Icono,
  onPress,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  color,
  selected,
  style,
  accessibilityHint,
}: Props): React.ReactElement {
  const { colors, isDark } = useTheme()
  const lado = LADO[size]
  const fondo =
    variant === 'primary'
      ? colors.primary
      : variant === 'tinta'
        ? colors.surfaceInverse
        : variant === 'soft'
          ? colors.surface2
          : 'transparent'
  const fondoPulsado =
    variant === 'primary'
      ? colors.primaryPressed
      : variant === 'tinta'
        ? isDark
          ? palette.papel[300]
          : palette.noche[700]
        : variant === 'soft'
          ? colors.border
          : colors.surface2
  const tinta =
    color ??
    (variant === 'primary'
      ? colors.primaryFg
      : variant === 'tinta'
        ? colors.fgInverse
        : colors.fg)

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      accessibilityState={{
        disabled,
        ...(selected !== undefined ? { selected } : {}),
      }}
      hitSlop={size === 'sm' ? 4 : 0}
      style={({ pressed }) => [
        styles.base,
        {
          width: lado,
          height: lado,
          backgroundColor: pressed ? fondoPulsado : fondo,
          borderColor:
            variant === 'outline' ? colors.borderStrong : 'transparent',
        },
        pressed ? styles.pulsado : null,
        disabled ? styles.inactivo : null,
        style,
      ]}
    >
      <Icono
        size={size === 'sm' ? 18 : 20}
        color={tinta}
        strokeWidth={1.75}
        accessible={false}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsado: { transform: [{ scale: 0.96 }] },
  inactivo: { opacity: 0.45 },
})
