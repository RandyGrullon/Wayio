import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme, type ThemeColors } from '../../theme'
import { Txt } from './Txt'
import type { LucideIcon } from './iconos'

export type BadgeVariant =
  | 'default'
  | 'brand'
  | 'accent'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'laton'

const TONOS: Record<
  BadgeVariant,
  { bg: keyof ThemeColors; fg: keyof ThemeColors }
> = {
  default: { bg: 'surface2', fg: 'fgMuted' },
  brand: { bg: 'accentSoft', fg: 'accentSoftFg' },
  accent: { bg: 'primarySoft', fg: 'primarySoftFg' },
  success: { bg: 'successBg', fg: 'successFg' },
  warning: { bg: 'warningBg', fg: 'warningFg' },
  error: { bg: 'dangerBg', fg: 'dangerFg' },
  info: { bg: 'infoBg', fg: 'infoFg' },
  laton: { bg: 'brassSoft', fg: 'brassSoftFg' },
}

/** Etiqueta de estado (§5.5): 24 de alto, 12 px, siempre en español. */
export function Badge({
  label,
  variant = 'default',
  icon: Icono,
  style,
}: {
  label: string
  variant?: BadgeVariant
  icon?: LucideIcon
  style?: StyleProp<ViewStyle>
}): React.ReactElement {
  const { colors, fonts } = useTheme()
  const t = TONOS[variant]
  return (
    <View style={[styles.badge, { backgroundColor: colors[t.bg] }, style]}>
      {Icono ? (
        <Icono
          size={13}
          color={colors[t.fg]}
          strokeWidth={2}
          accessible={false}
        />
      ) : null}
      <Txt
        variant="caption"
        color={t.fg}
        maxFontSizeMultiplier={1.3}
        style={[styles.texto, { fontFamily: fonts.sansSemiBold }]}
      >
        {label}
      </Txt>
    </View>
  )
}

type TonoSello = 'tinta' | 'laton' | 'rosa' | 'exito' | 'peligro'

const COLOR_SELLO: Record<TonoSello, keyof ThemeColors> = {
  tinta: 'fg',
  laton: 'brassText',
  rosa: 'primaryText',
  exito: 'success',
  peligro: 'danger',
}

/**
 * Sello informativo (§5.5): 12 px, mayúsculas y SIN rotar. Para «SOLO
 * LECTURA», «DISPONIBLE SIN CONEXIÓN», «COMPARTIDO CONTIGO»…
 */
export function SelloInfo({
  children,
  tone = 'tinta',
  icon: Icono,
  style,
}: {
  children: string
  tone?: TonoSello
  icon?: LucideIcon
  style?: StyleProp<ViewStyle>
}): React.ReactElement {
  const { colors, fonts } = useTheme()
  const color = colors[COLOR_SELLO[tone]]
  return (
    <View style={[styles.sello, { borderColor: color }, style]}>
      {Icono ? (
        <Icono size={13} color={color} strokeWidth={2} accessible={false} />
      ) : null}
      <Txt
        variant="overline"
        color={COLOR_SELLO[tone]}
        maxFontSizeMultiplier={1.3}
        style={[styles.selloTexto, { fontFamily: fonts.sansSemiBold }]}
      >
        {children}
      </Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  texto: { fontSize: 12, lineHeight: 16, letterSpacing: 0.24 },
  sello: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  selloTexto: { letterSpacing: 1.4, lineHeight: 16 },
})
