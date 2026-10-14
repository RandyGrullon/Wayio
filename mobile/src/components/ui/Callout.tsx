import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { alpha, useTheme, type ThemeColors } from '../../theme'
import { Txt } from './Txt'
import { Button } from './Button'
import { IconButton } from './IconButton'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  type LucideIcon,
} from './iconos'

export type CalloutTone = 'info' | 'success' | 'warning' | 'danger'

const TONOS: Record<
  CalloutTone,
  {
    bg: keyof ThemeColors
    fg: keyof ThemeColors
    borde: keyof ThemeColors
    icono: LucideIcon
  }
> = {
  info: { bg: 'infoBg', fg: 'infoFg', borde: 'info', icono: Info },
  success: {
    bg: 'successBg',
    fg: 'successFg',
    borde: 'success',
    icono: CheckCircle2,
  },
  warning: {
    bg: 'warningBg',
    fg: 'warningFg',
    borde: 'warning',
    icono: AlertTriangle,
  },
  danger: {
    bg: 'dangerBg',
    fg: 'dangerFg',
    borde: 'danger',
    icono: AlertCircle,
  },
}

interface Props {
  tone?: CalloutTone
  title?: string
  children?: ReactNode
  icon?: LucideIcon
  /** Acción en forma de enlace («Reintentar»). */
  action?: { label: string; onPress: () => void }
  onDismiss?: () => void
  style?: StyleProp<ViewStyle>
}

/**
 * Aviso del sistema (§5.4). Sustituye a todos los avisos escritos a mano.
 * `danger` se anuncia como alerta; el resto, como estado.
 */
export function Callout({
  tone = 'info',
  title,
  children,
  icon,
  action,
  onDismiss,
  style,
}: Props): React.ReactElement {
  const { colors } = useTheme()
  const t = TONOS[tone]
  const Icono = icon ?? t.icono
  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : 'summary'}
      accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'polite'}
      style={[
        styles.caja,
        {
          backgroundColor: colors[t.bg],
          borderColor: alpha(colors[t.borde], 0.3),
        },
        style,
      ]}
    >
      <Icono
        size={20}
        color={colors[t.fg]}
        strokeWidth={1.75}
        accessible={false}
      />
      <View style={styles.cuerpo}>
        {title ? (
          <Txt variant="label" color={t.fg} style={styles.titulo}>
            {title}
          </Txt>
        ) : null}
        {typeof children === 'string' ? (
          <Txt variant="bodyS" color={t.fg}>
            {children}
          </Txt>
        ) : (
          children
        )}
        {action ? (
          <Button
            variant="link"
            title={action.label}
            onPress={action.onPress}
            style={styles.accion}
          />
        ) : null}
      </View>
      {onDismiss ? (
        <IconButton
          label="Cerrar aviso"
          icon={X}
          size="sm"
          color={colors[t.fg]}
          onPress={onDismiss}
          style={styles.cerrar}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  caja: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cuerpo: { flex: 1, gap: 4 },
  titulo: { fontSize: 15 },
  accion: { marginTop: 2 },
  cerrar: { marginTop: -8, marginRight: -8 },
})
