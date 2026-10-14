import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { alpha, palette, useTheme, type Tema } from '../../theme'
import type { LucideIcon } from './iconos'

export type ButtonVariant =
  | 'primary'
  | 'tinta'
  | 'soft'
  | 'outline'
  | 'ghost'
  | 'link'
  | 'danger'
  | 'danger-outline'
  /** @deprecated usa `soft`. */
  | 'secondary'

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

interface Props {
  title: string
  onPress: () => void
  /** `primary` solo uno por vista; `danger` solo dentro de ConfirmDialog. */
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  /** Texto mientras carga, en gerundio («Guardando…»). */
  loadingText?: string
  icon?: LucideIcon
  iconEnd?: LucideIcon
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  accessibilityHint?: string
  testID?: string
}

interface Colores {
  bg: string
  bgPressed: string
  fg: string
  border: string
}

function coloresDe(variant: ButtonVariant, tema: Tema): Colores {
  const c = tema.colors
  const inversoPulsado = tema.isDark ? palette.papel[300] : palette.noche[700]
  switch (variant) {
    case 'primary':
      return {
        bg: c.primary,
        bgPressed: c.primaryPressed,
        fg: c.primaryFg,
        border: c.primary,
      }
    case 'tinta':
      return {
        bg: c.surfaceInverse,
        bgPressed: inversoPulsado,
        fg: c.fgInverse,
        border: c.surfaceInverse,
      }
    case 'soft':
    case 'secondary':
      return {
        bg: c.surface2,
        bgPressed: c.border,
        fg: c.fg,
        border: c.surface2,
      }
    case 'outline':
      return {
        bg: 'transparent',
        bgPressed: c.surface2,
        fg: c.fg,
        border: c.borderStrong,
      }
    case 'ghost':
      return {
        bg: 'transparent',
        bgPressed: c.surface2,
        fg: c.fg,
        border: 'transparent',
      }
    case 'link':
      return {
        bg: 'transparent',
        bgPressed: 'transparent',
        fg: c.accent,
        border: 'transparent',
      }
    case 'danger':
      return {
        bg: c.danger,
        bgPressed: c.dangerFg,
        fg: c.onDanger,
        border: c.danger,
      }
    case 'danger-outline':
      return {
        bg: 'transparent',
        bgPressed: c.dangerBg,
        fg: c.danger,
        border: alpha(c.danger, 0.4),
      }
  }
}

const MEDIDAS: Record<
  ButtonSize,
  { alto: number; px: number; texto: number; icono: number }
> = {
  sm: { alto: 36, px: 14, texto: 14, icono: 16 },
  md: { alto: 44, px: 18, texto: 15, icono: 18 },
  lg: { alto: 52, px: 22, texto: 16, icono: 18 },
  xl: { alto: 60, px: 28, texto: 17, icono: 20 },
}

/**
 * Botón del sistema (§5.1). Pastilla redondeada, Instrument Sans 600 y
 * estados de pulsado/deshabilitado/carga. El área táctil mínima es de 44.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  loadingText,
  icon: Icono,
  iconEnd: IconoFinal,
  fullWidth = false,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: Props): React.ReactElement {
  const tema = useTheme()
  const col = coloresDe(variant, tema)
  const m = MEDIDAS[size]
  const inactivo = disabled || loading
  const esLink = variant === 'link'
  const texto = loading && loadingText ? loadingText : title

  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole={esLink ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel ?? texto}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      accessibilityState={{ disabled: inactivo, busy: loading }}
      hitSlop={
        esLink || size === 'sm' ? { top: 6, bottom: 6, left: 4, right: 4 } : 4
      }
      {...(testID ? { testID } : {})}
      style={({ pressed }) => [
        styles.base,
        esLink
          ? styles.link
          : {
              minHeight: m.alto,
              paddingHorizontal: m.px,
              backgroundColor: pressed ? col.bgPressed : col.bg,
              borderColor: col.border,
            },
        fullWidth ? styles.full : null,
        pressed && !esLink ? styles.pulsado : null,
        pressed && esLink ? styles.linkPulsado : null,
        inactivo ? styles.inactivo : null,
        style,
      ]}
    >
      <View style={styles.fila}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={col.fg}
            style={{ width: m.icono, height: m.icono }}
          />
        ) : Icono ? (
          <Icono
            size={m.icono}
            color={col.fg}
            strokeWidth={1.75}
            accessible={false}
          />
        ) : null}
        <Text
          maxFontSizeMultiplier={1.4}
          numberOfLines={esLink ? undefined : 1}
          style={[
            styles.texto,
            {
              color: col.fg,
              fontSize: m.texto,
              fontFamily: tema.fonts.sansSemiBold,
            },
            esLink ? styles.textoLink : null,
          ]}
        >
          {texto}
        </Text>
        {IconoFinal && !loading ? (
          <IconoFinal
            size={m.icono}
            color={col.fg}
            strokeWidth={1.75}
            accessible={false}
          />
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  full: { alignSelf: 'stretch' },
  link: {
    borderWidth: 0,
    paddingHorizontal: 0,
    minHeight: 32,
    borderRadius: 4,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  texto: { textAlign: 'center', flexShrink: 1 },
  textoLink: {
    textDecorationLine: 'underline',
  },
  pulsado: { transform: [{ scale: 0.98 }] },
  linkPulsado: { opacity: 0.7 },
  inactivo: { opacity: 0.45 },
})
