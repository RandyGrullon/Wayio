/**
 * Clima con OpenWeather (plan gratis: clima actual + pronóstico de 5 días).
 *
 * - Si el viaje empieza en ≤5 días usamos el PRONÓSTICO real de esas fechas
 *   (y se lo pasamos a la IA).
 * - Si no, solo mostramos el clima ACTUAL del destino como referencia
 *   (tipo 'actual'); la IA planifica con el clima típico de la temporada.
 */

const OW_BASE_URL = 'https://api.openweathermap.org/data/2.5'

export interface WeatherData {
  temp: number
  description: string
  humidity: number
  windSpeed: number
  icon: string
  /** 'pronostico' = previsión para las fechas del viaje; 'actual' = ahora mismo. */
  tipo?: 'actual' | 'pronostico'
  tempMin?: number
  tempMax?: number
}

export interface TripWeather {
  weather: WeatherData
  /** Resumen del pronóstico por día para el prompt (solo si tipo 'pronostico'). */
  resumen: string | null
}

const key = (): string | undefined => process.env['OPENWEATHER_API_KEY']

interface OwCurrent {
  main: { temp: number; humidity: number }
  weather: Array<{ description: string; icon: string }>
  wind: { speed: number }
}

function fromCurrent(data: OwCurrent): WeatherData {
  return {
    temp: data.main.temp,
    description: data.weather[0]?.description ?? '',
    humidity: data.main.humidity,
    windSpeed: data.wind.speed,
    icon: data.weather[0]?.icon ?? '',
    tipo: 'actual',
  }
}

export async function getWeather(
  lat: number,
  lng: number
): Promise<WeatherData> {
  const apiKey = key()
  if (!apiKey) throw new Error('OpenWeather API key not configured')
  const res = await fetch(
    `${OW_BASE_URL}/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=es`,
    { next: { revalidate: 600 }, signal: AbortSignal.timeout(6000) }
  )
  if (!res.ok) throw new Error(`OpenWeather request failed: ${res.status}`)
  return fromCurrent((await res.json()) as OwCurrent)
}

/** Clima actual por nombre de ciudad (compatibilidad). */
export async function getWeatherByCity(city: string): Promise<WeatherData> {
  const apiKey = key()
  if (!apiKey) throw new Error('OpenWeather API key not configured')
  const res = await fetch(
    `${OW_BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=es`,
    { next: { revalidate: 600 }, signal: AbortSignal.timeout(6000) }
  )
  if (!res.ok) throw new Error(`OpenWeather request failed: ${res.status}`)
  return fromCurrent((await res.json()) as OwCurrent)
}

interface OwForecast {
  list: Array<{
    dt_txt: string
    main: { temp: number; temp_min: number; temp_max: number; humidity: number }
    weather: Array<{ description: string; icon: string }>
    wind: { speed: number }
  }>
}

/**
 * Clima para un viaje: pronóstico de sus fechas si caen en los próximos 5
 * días; si no, clima actual. Nunca lanza: devuelve null si no hay key o falla.
 */
export async function getTripWeather(
  punto: { lat: number; lng: number },
  fechaInicio: string,
  fechaFin: string,
  hoy: string
): Promise<TripWeather | null> {
  const apiKey = key()
  if (!apiKey) return null
  const diasHastaSalida = Math.round(
    (Date.parse(`${fechaInicio}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) /
      86_400_000
  )
  try {
    if (diasHastaSalida >= 0 && diasHastaSalida <= 4) {
      const res = await fetch(
        `${OW_BASE_URL}/forecast?lat=${punto.lat}&lon=${punto.lng}&appid=${apiKey}&units=metric&lang=es`,
        { next: { revalidate: 1800 }, signal: AbortSignal.timeout(6000) }
      )
      if (res.ok) {
        const data = (await res.json()) as OwForecast
        const porDia = new Map<string, OwForecast['list']>()
        for (const p of data.list) {
          const fecha = p.dt_txt.slice(0, 10)
          if (fecha < fechaInicio || fecha > fechaFin) continue
          porDia.set(fecha, [...(porDia.get(fecha) ?? []), p])
        }
        if (porDia.size > 0) {
          const dias = [...porDia.entries()].map(([fecha, ps]) => {
            const min = Math.round(Math.min(...ps.map((p) => p.main.temp_min)))
            const max = Math.round(Math.max(...ps.map((p) => p.main.temp_max)))
            // Descripción del mediodía (o la más frecuente).
            const medio = ps.find((p) => p.dt_txt.includes('12:00')) ?? ps[0]
            return {
              fecha,
              min,
              max,
              desc: medio?.weather[0]?.description ?? '',
              icon: medio?.weather[0]?.icon ?? '',
              hum: medio?.main.humidity ?? 0,
              wind: medio?.wind.speed ?? 0,
            }
          })
          const primero = dias[0]
          if (primero) {
            return {
              weather: {
                temp: Math.round((primero.min + primero.max) / 2),
                tempMin: Math.min(...dias.map((d) => d.min)),
                tempMax: Math.max(...dias.map((d) => d.max)),
                description: primero.desc,
                humidity: primero.hum,
                windSpeed: primero.wind,
                icon: primero.icon,
                tipo: 'pronostico',
              },
              resumen: dias
                .map((d) => `${d.fecha}: ${d.min}-${d.max} °C, ${d.desc}`)
                .join('; '),
            }
          }
        }
      }
    }
    return { weather: await getWeather(punto.lat, punto.lng), resumen: null }
  } catch {
    return null
  }
}
