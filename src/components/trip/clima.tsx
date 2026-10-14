import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Snowflake,
  Sun,
} from 'lucide-react'
import type { WeatherData } from '@/lib/api/openweather'

/** Icono lucide para un código de OpenWeather («01d», «10n»…). Decorativo. */
export function IconoClima({
  codigo,
  className,
}: {
  codigo: string | undefined
  className?: string
}) {
  const props = { 'aria-hidden': true, strokeWidth: 1.75, className }
  switch ((codigo ?? '').slice(0, 2)) {
    case '01':
      return <Sun {...props} />
    case '03':
    case '04':
      return <Cloud {...props} />
    case '09':
      return <CloudDrizzle {...props} />
    case '10':
      return <CloudRain {...props} />
    case '11':
      return <CloudLightning {...props} />
    case '13':
      return <Snowflake {...props} />
    case '50':
      return <CloudFog {...props} />
    default:
      return <CloudSun {...props} />
  }
}

/**
 * Etiqueta honesta del clima (docs/DISENO.md §6.5): «Pronóstico para tu
 * viaje» si es previsión; si no, «Ahora en <destino>» (es el clima actual).
 */
export function textoClima(
  weather: WeatherData,
  destino: string
): { etiqueta: string; valor: string } {
  const descripcion = weather.description?.trim() ?? ''
  const temp =
    weather.tipo === 'pronostico' &&
    typeof weather.tempMin === 'number' &&
    typeof weather.tempMax === 'number'
      ? `${Math.round(weather.tempMin)}–${Math.round(weather.tempMax)} °C`
      : `${Math.round(weather.temp)} °C`
  return {
    etiqueta:
      weather.tipo === 'pronostico'
        ? 'Pronóstico para tu viaje'
        : `Ahora en ${destino}`,
    valor: descripcion ? `${temp}, ${descripcion.toLowerCase()}` : temp,
  }
}
