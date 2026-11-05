import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMantenimiento } from '../hooks/useConfigRemota'
import { useEstilos, useTheme, type Tema } from '../theme'
import { Txt } from './ui/Txt'
import { AlertTriangle } from './ui/iconos'

/**
 * Aviso de modo mantenimiento (app_settings.maintenance_mode, desde el
 * admin), arriba de todas las pantallas (RootNavigator). Banda en el tono
 * warning con el mensaje configurado; no se puede cerrar: dura lo que dure
 * el mantenimiento. Se come el área segura de arriba, así que las pantallas
 * de debajo (SafeAreaView nativo) no la repiten.
 *
 * Mientras está activo, generar y ajustar con IA no se intentan (y el
 * servidor respondería 503 code 'mantenimiento' con este mismo mensaje).
 */
export function AvisoMantenimiento(): React.ReactElement | null {
  const { activo, mensaje } = useMantenimiento()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)

  if (!activo) return null

  return (
    <View
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      style={[
        styles.banda,
        {
          paddingTop: insets.top + 8,
          paddingLeft: insets.left + 16,
          paddingRight: insets.right + 16,
        },
      ]}
    >
      <AlertTriangle
        size={18}
        strokeWidth={1.75}
        color={colors.warningFg}
        accessible={false}
        style={styles.icono}
      />
      <Txt variant="bodyS" color="warningFg" style={styles.texto}>
        <Txt variant="label" color="warningFg">
          En mantenimiento
        </Txt>
        {` · ${mensaje}`}
      </Txt>
    </View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    banda: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingBottom: 8,
      minHeight: 40,
      backgroundColor: t.colors.warningBg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    icono: { marginTop: 2 },
    texto: { flex: 1 },
  })
