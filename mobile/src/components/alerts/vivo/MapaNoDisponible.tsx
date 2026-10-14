import { StyleSheet, View } from 'react-native'
import { useEstilos, useTheme, type Tema } from '../../../theme'
import { Txt } from '../../ui/Txt'
import { Button } from '../../ui/Button'
import { MapIcon, Navigation } from '../../ui/iconos'
import { abrirComoLlegar } from '../../../lib/geofencing/navegacion'

interface Destino {
  lat: number
  lng: number
  nombre: string
}

interface Props {
  /** Lugar al que ofrecer «Cómo llegar» en la app de mapas. */
  destino: Destino | null
  /** true si falta el token de Mapbox (solo se explica en desarrollo). */
  sinToken: boolean
}

/** Estado vacío del mapa (Expo Go, sin token o error del módulo nativo). */
export function MapaNoDisponible({
  destino,
  sinToken,
}: Props): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const { colors } = useTheme()
  return (
    <View style={styles.contenedor}>
      <View style={styles.icono}>
        <MapIcon
          size={28}
          color={colors.fgMuted}
          strokeWidth={1.75}
          accessible={false}
        />
      </View>
      <Txt variant="h3" center>
        El mapa no está disponible aquí
      </Txt>
      <Txt variant="bodyS" color="fgMuted" center style={styles.texto}>
        Tus llegadas y alertas siguen funcionando en «Hoy». Para ver la ruta,
        ábrela en la app de mapas de tu teléfono.
      </Txt>
      {destino ? (
        <Button
          title={`Cómo llegar a ${destino.nombre}`}
          icon={Navigation}
          variant="outline"
          onPress={() =>
            abrirComoLlegar(destino.lat, destino.lng, destino.nombre)
          }
          style={styles.boton}
        />
      ) : null}
      {__DEV__ ? (
        <Txt variant="caption" color="fgSubtle" center style={styles.texto}>
          {sinToken
            ? 'Solo desarrollo: falta EXPO_PUBLIC_MAPBOX_TOKEN (token público pk.*).'
            : 'Solo desarrollo: el mapa necesita un development build (no Expo Go).'}
        </Txt>
      ) : null}
    </View>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    contenedor: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: t.space[8],
      gap: t.space[3],
      backgroundColor: t.colors.bg,
    },
    icono: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: t.colors.surface2,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: t.space[2],
    },
    texto: { maxWidth: 340 },
    boton: { alignSelf: 'center', marginTop: t.space[2] },
  })
