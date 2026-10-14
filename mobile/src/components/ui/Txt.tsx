import {
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native'
import { useTheme, type ThemeColors, type TypeVariant } from '../../theme'

export type ColorTexto = keyof ThemeColors

interface Props extends TextProps {
  /** Rol tipográfico de §11 (`type`). */
  variant?: TypeVariant
  /** Token de color del tema (por defecto `fg`). */
  color?: ColorTexto
  /** Itálica de Newsreader (una palabra o el nombre del destino). */
  italic?: boolean
  center?: boolean
  /** Cifras tabulares (importes, horas, contadores). */
  tnum?: boolean
  style?: StyleProp<TextStyle>
}

const TITULARES: readonly TypeVariant[] = [
  'displayXL',
  'displayL',
  'h1',
  'h2',
  'h3',
]

/**
 * Texto con los roles tipográficos del sistema y colores del tema. Los
 * titulares se anuncian como encabezados. El texto escala con la fuente del
 * sistema, con tope para que el diseño no se rompa.
 */
export function Txt({
  variant = 'body',
  color = 'fg',
  italic = false,
  center = false,
  tnum = false,
  style,
  accessibilityRole,
  maxFontSizeMultiplier,
  ...rest
}: Props): React.ReactElement {
  const { colors, type, fonts } = useTheme()
  const esTitular = TITULARES.includes(variant)
  return (
    <Text
      accessibilityRole={accessibilityRole ?? (esTitular ? 'header' : 'text')}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (esTitular ? 1.3 : 1.6)}
      style={[
        type[variant],
        { color: colors[color] },
        italic ? { fontFamily: fonts.displayItalic } : null,
        center ? { textAlign: 'center' } : null,
        tnum ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
      {...rest}
    />
  )
}
