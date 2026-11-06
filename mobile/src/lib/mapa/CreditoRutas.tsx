import {
  Linking,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { config } from '../../config'
import { useEstilos, type Tema } from '../../theme'
import { Txt } from '../../components/ui/Txt'

/**
 * Créditos del proveedor de rutas y geocodificación junto al mapa, como en la
 * web (TripMap.tsx, CREDITOS_GEO). Geoapify exige en su plan Free un enlace
 * «Powered by Geoapify» donde se ven sus coordenadas y rutas; con el backend
 * en OSM (EXPO_PUBLIC_GEO_PROVEEDOR=osm) las rutas son de OSRM (FOSSGIS). El
 * crédito de OpenStreetMap ya va en los de Mapbox (botón «i»).
 */
export function CreditoRutas({
  style,
}: {
  /** Posición sobre el mapa (p. ej. absoluta arriba a la izquierda). */
  style?: StyleProp<ViewStyle>
}): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  if (!config.creditosGeoapify) {
    return (
      <View style={[styles.creditos, style]}>
        <Txt variant="caption" color="fgMuted">
          Rutas: OSRM · FOSSGIS
        </Txt>
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Powered by Geoapify. Abre geoapify.com"
      onPress={() => {
        Linking.openURL('https://www.geoapify.com/').catch(() => undefined)
      }}
      hitSlop={8}
      style={[styles.creditos, style]}
    >
      <Txt variant="caption" color="fgMuted">
        Powered by Geoapify
      </Txt>
    </Pressable>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    creditos: {
      paddingHorizontal: t.space[2],
      paddingVertical: 2,
      borderRadius: t.radius.control,
      backgroundColor: t.colors.surfaceRaised,
      opacity: 0.9,
    },
  })
