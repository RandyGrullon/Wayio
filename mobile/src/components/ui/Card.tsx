import type { ReactNode } from 'react'
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Svg, { Line } from 'react-native-svg'
import { useEstilos, useTheme, type Tema } from '../../theme'
import { Txt, type ColorTexto } from './Txt'
import type { LucideIcon } from './iconos'

export type CardVariant =
  | 'default'
  | 'elevated'
  | 'selected'
  | 'nota'
  | 'boleto'
  | 'inverse'

interface Props {
  children: ReactNode
  variant?: CardVariant
  style?: StyleProp<ViewStyle>
  /** Si se pasa, la tarjeta entera es pulsable. */
  onPress?: () => void
  accessibilityLabel?: string
  accessibilityHint?: string
  accessibilityRole?: AccessibilityRole
  accessibilityState?: AccessibilityState
  disabled?: boolean
}

/** Tarjeta del sistema (§5.4): papel, filete fino y radio 16. */
export function Card({
  children,
  variant = 'default',
  style,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  accessibilityState,
  disabled,
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const base = [styles.base, styles[variant]]

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled ?? false}
        accessibilityRole={accessibilityRole ?? 'button'}
        {...(accessibilityLabel ? { accessibilityLabel } : {})}
        {...(accessibilityHint ? { accessibilityHint } : {})}
        {...(accessibilityState ? { accessibilityState } : {})}
        style={({ pressed }) => [base, pressed ? styles.pulsada : null, style]}
      >
        {children}
      </Pressable>
    )
  }
  return (
    <View
      style={[base, style]}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      {...(accessibilityRole ? { accessibilityRole } : {})}
    >
      {children}
    </View>
  )
}

/** Overline de tarjeta («NOTAS DE RUTA», «DÍA 02 · …»). */
export function CardKicker({
  children,
  color = 'fgMuted',
  icon: Icono,
  style,
}: {
  children: ReactNode
  color?: ColorTexto
  icon?: LucideIcon
  style?: StyleProp<ViewStyle>
}): React.ReactElement {
  const { colors } = useTheme()
  return (
    <View style={[estilosFijos.kicker, style]}>
      {Icono ? (
        <Icono
          size={14}
          color={colors[color]}
          strokeWidth={1.75}
          accessible={false}
        />
      ) : null}
      <Txt variant="overline" color={color}>
        {children}
      </Txt>
    </View>
  )
}

/** Franja de tinta del boleto («WAYIO · TU RUTA»). */
export function CardFranja({
  children,
  extra,
}: {
  children: ReactNode
  extra?: ReactNode
}): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  return (
    <View style={styles.franja}>
      <Txt variant="overline" color="fgInverse">
        {children}
      </Txt>
      {extra ? (
        <Txt variant="overline" color="fgInverse">
          {extra}
        </Txt>
      ) : null}
    </View>
  )
}

/** Fila etiqueta / valor del boleto. */
export function CardFila({
  etiqueta,
  children,
  icon: Icono,
}: {
  etiqueta: string
  children: ReactNode
  icon?: LucideIcon
}): React.ReactElement {
  const { colors } = useTheme()
  return (
    <View style={estilosFijos.fila} accessible>
      <View style={estilosFijos.kicker}>
        {Icono ? (
          <Icono
            size={14}
            color={colors.fgMuted}
            strokeWidth={1.75}
            accessible={false}
          />
        ) : null}
        <Txt variant="overline" color="fgMuted">
          {etiqueta}
        </Txt>
      </View>
      <Txt variant="h3" style={estilosFijos.valor}>
        {children}
      </Txt>
    </View>
  )
}

/** Divisor de boleto con muescas (la tarjeta padre es `boleto`). */
export function CardPerforado(): React.ReactElement {
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  return (
    <View style={styles.perforado} accessible={false}>
      <View style={[styles.muesca, styles.muescaIzq]} />
      <Svg height={2} style={estilosFijos.linea}>
        <Line
          x1="0"
          y1="1"
          x2="100%"
          y2="1"
          stroke={colors.rule}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      </Svg>
      <View style={[styles.muesca, styles.muescaDer]} />
    </View>
  )
}

const estilosFijos = StyleSheet.create({
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fila: { paddingVertical: 10, gap: 2 },
  valor: { marginTop: 2 },
  linea: { flex: 1, marginHorizontal: 14 },
})

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    base: { borderRadius: t.radius.card },
    pulsada: { opacity: 0.92, transform: [{ scale: 0.99 }] },
    default: {
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: 20,
    },
    elevated: {
      backgroundColor: t.isDark ? t.colors.surfaceRaised : t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: 20,
      ...(t.isDark ? {} : t.elevation.elev),
    },
    selected: {
      backgroundColor: t.colors.surface,
      borderWidth: 2,
      borderColor: t.colors.fg,
      padding: 19,
      ...(t.isDark ? {} : t.elevation.elev),
    },
    nota: {
      backgroundColor: t.colors.brassSoft,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.brass,
      padding: 20,
    },
    boleto: {
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      overflow: 'hidden',
    },
    inverse: {
      backgroundColor: t.colors.surfaceInverse,
      padding: 20,
    },
    franja: {
      backgroundColor: t.colors.surfaceInverse,
      height: 36,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    perforado: {
      height: 20,
      flexDirection: 'row',
      alignItems: 'center',
    },
    muesca: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: t.colors.bg,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    muescaIzq: { marginLeft: -11 },
    muescaDer: { marginRight: -11 },
  })
