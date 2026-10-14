import { Image, StyleSheet, View } from 'react-native'
import { useTheme } from '../../theme'
import { Txt } from '../ui/Txt'
import type { WeatherData } from '../../types/planning'

/**
 * Franja del clima con etiqueta honesta (§6.5): «Pronóstico para tu viaje»
 * si el dato es un pronóstico; si no, «Ahora en <destino>» (clima actual).
 */
export function WeatherStrip({
  weather,
  destino,
}: {
  weather: WeatherData
  destino?: string
}): React.ReactElement {
  const { colors } = useTheme()
  const etiqueta =
    weather.tipo === 'pronostico'
      ? 'Pronóstico para tu viaje'
      : destino
        ? `Ahora en ${destino}`
        : 'Clima ahora'
  const rango =
    weather.tipo === 'pronostico' &&
    typeof weather.tempMin === 'number' &&
    typeof weather.tempMax === 'number'
      ? `${Math.round(weather.tempMin)}–${Math.round(weather.tempMax)} °C`
      : `${Math.round(weather.temp)} °C`

  return (
    <View
      style={[
        styles.strip,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      accessible
      accessibilityLabel={`${etiqueta}: ${rango}, ${weather.description}`}
    >
      {weather.icon ? (
        <Image
          source={{
            uri: `https://openweathermap.org/img/wn/${weather.icon}@2x.png`,
          }}
          style={styles.icon}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={styles.flex}>
        <Txt variant="overline" color="fgMuted">
          {etiqueta}
        </Txt>
        <Txt variant="bodyS" numberOfLines={1} style={styles.desc}>
          <Txt variant="label" tnum>
            {rango}
          </Txt>
          {weather.description ? ` · ${weather.description}` : ''}
        </Txt>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  flex: { flex: 1 },
  icon: { width: 40, height: 40 },
  desc: { marginTop: 2 },
})
