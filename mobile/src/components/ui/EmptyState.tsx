import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from '../../theme'
import { IlustracionRuta } from '../brand/IlustracionRuta'
import { Button } from './Button'
import { Txt } from './Txt'
import { CloudOff, type LucideIcon } from './iconos'

interface Props {
  title: string
  description?: string
  /**
   * UNA sola acción. Por defecto es `primary` (o `outline` en errores); usa
   * `variant: 'outline'` si la vista ya tiene otro botón primario.
   */
  action?: {
    label: string
    onPress: () => void
    icon?: LucideIcon
    variant?: 'primary' | 'outline' | 'tinta'
  }
  /** ruta (vacío), error (no pudimos cargar), icono o ninguna. */
  ilustracion?: 'ruta' | 'error' | 'icono' | 'ninguna'
  icon?: LucideIcon
  style?: StyleProp<ViewStyle>
}

/**
 * Estado vacío o de error (§5.10). El error es distinto del vacío: lleva
 * `CloudOff` y la acción suele ser «Reintentar».
 */
export function EmptyState({
  title,
  description,
  action,
  ilustracion = 'ruta',
  icon: Icono,
  style,
}: Props): React.ReactElement {
  const { colors } = useTheme()
  const IconoFinal = ilustracion === 'error' ? CloudOff : Icono
  return (
    <View style={[styles.caja, style]}>
      {ilustracion === 'ruta' ? (
        <IlustracionRuta />
      ) : IconoFinal && ilustracion !== 'ninguna' ? (
        <View
          style={[
            styles.icono,
            { backgroundColor: colors.surface2, borderColor: colors.border },
          ]}
        >
          <IconoFinal
            size={28}
            color={ilustracion === 'error' ? colors.fgMuted : colors.fg}
            strokeWidth={1.75}
            accessible={false}
          />
        </View>
      ) : null}
      <Txt variant="h3" center style={styles.titulo}>
        {title}
      </Txt>
      {description ? (
        <Txt variant="bodyS" color="fgMuted" center style={styles.desc}>
          {description}
        </Txt>
      ) : null}
      {action ? (
        <Button
          title={action.label}
          onPress={action.onPress}
          {...(action.icon ? { icon: action.icon } : {})}
          variant={
            action.variant ?? (ilustracion === 'error' ? 'outline' : 'primary')
          }
          style={styles.accion}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  caja: {
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: 360,
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  icono: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { marginTop: 16 },
  desc: { marginTop: 6, maxWidth: 320 },
  accion: { marginTop: 20, alignSelf: 'center' },
})
