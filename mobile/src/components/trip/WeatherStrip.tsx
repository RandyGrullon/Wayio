import { Image, StyleSheet, Text, View } from 'react-native'
import { colors, radius } from '../../theme'
import type { WeatherData } from '../../types/planning'

export function WeatherStrip({
  weather,
}: {
  weather: WeatherData
}): React.ReactElement {
  return (
    <View style={styles.strip}>
      {weather.icon ? (
        <Image
          source={{
            uri: `https://openweathermap.org/img/wn/${weather.icon}@2x.png`,
          }}
          alt={weather.description}
          style={styles.icon}
        />
      ) : null}
      <Text style={styles.temp}>{Math.round(weather.temp)}°C</Text>
      <Text style={styles.desc} numberOfLines={1}>
        {weather.description}
      </Text>
      <Text style={styles.meta}>· {weather.humidity}% hum.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.skyBg,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  icon: { width: 36, height: 36 },
  temp: { fontSize: 15, fontWeight: '700', color: colors.text, marginLeft: 4 },
  desc: {
    fontSize: 13,
    color: colors.textMuted,
    marginLeft: 8,
    textTransform: 'capitalize',
    flexShrink: 1,
  },
  meta: { fontSize: 12, color: colors.textFaint, marginLeft: 8 },
})
