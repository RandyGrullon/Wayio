import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useEstilos, useTheme, type Tema } from '../../theme'
import { Txt } from './Txt'
import { Check, type LucideIcon } from './iconos'

interface ChipProps {
  label: string
  selected?: boolean
  icon?: LucideIcon
  onPress: () => void
  disabled?: boolean
  size?: 'md' | 'sm'
  /** radio (grupo exclusivo), checkbox (toggle) o button (sugerencia). */
  role?: 'radio' | 'checkbox' | 'button'
  accessibilityLabel?: string
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
}

/**
 * Chip de elección (§5.3). Seleccionado = tinta (nunca magenta). El icono
 * pasa a `Check` al seleccionar, así el estado no depende solo del color.
 */
export function Chip({
  label,
  selected = false,
  icon: Icono,
  onPress,
  disabled = false,
  size = 'md',
  role = 'checkbox',
  accessibilityLabel,
  accessibilityHint,
  style,
}: ChipProps): React.ReactElement {
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  const IconoActual = selected && role !== 'button' ? Check : Icono
  const fg = selected ? colors.fgInverse : colors.fg

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      accessibilityState={
        role === 'button'
          ? { disabled, selected }
          : { disabled, checked: selected }
      }
      hitSlop={{ top: 2, bottom: 2 }}
      style={({ pressed }) => [
        styles.chip,
        size === 'sm' ? styles.chipSm : null,
        selected ? styles.chipOn : null,
        pressed && !selected ? styles.chipPulsado : null,
        disabled ? styles.inactivo : null,
        style,
      ]}
    >
      {IconoActual ? (
        <IconoActual
          size={size === 'sm' ? 16 : 18}
          color={fg}
          strokeWidth={1.75}
          accessible={false}
        />
      ) : null}
      <Txt
        variant="bodyS"
        color={selected ? 'fgInverse' : 'fg'}
        maxFontSizeMultiplier={1.4}
        style={[styles.texto, size === 'sm' ? styles.textoSm : null]}
      >
        {label}
      </Txt>
    </Pressable>
  )
}

export interface OpcionChip<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
  disabled?: boolean
}

/** Grupo exclusivo de chips (radiogroup). Disposición con wrap, sin huérfanos. */
export function ChipGroup<T extends string>({
  options,
  value,
  onValueChange,
  label,
  size = 'md',
  style,
}: {
  options: readonly OpcionChip<T>[]
  value: T | null
  onValueChange: (v: T) => void
  /** Nombre del grupo para el lector de pantalla. */
  label: string
  size?: 'md' | 'sm'
  style?: StyleProp<ViewStyle>
}): React.ReactElement {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[estilosGrupo.grupo, style]}
    >
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          role="radio"
          size={size}
          selected={o.value === value}
          {...(o.icon ? { icon: o.icon } : {})}
          disabled={o.disabled ?? false}
          onPress={() => onValueChange(o.value)}
        />
      ))}
    </View>
  )
}

const estilosGrupo = StyleSheet.create({
  grupo: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 40,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surface,
    },
    chipSm: { minHeight: 36, paddingHorizontal: 12, gap: 6 },
    chipOn: {
      backgroundColor: t.colors.surfaceInverse,
      borderColor: t.colors.surfaceInverse,
    },
    chipPulsado: { backgroundColor: t.colors.surface2 },
    inactivo: { opacity: 0.45 },
    texto: { fontFamily: t.fonts.sansMedium, fontSize: 15, lineHeight: 20 },
    textoSm: { fontSize: 14, lineHeight: 18 },
  })
