const OW_BASE_URL = 'https://api.openweathermap.org/data/2.5'

export interface WeatherData {
  temp: number
  description: string
  humidity: number
  windSpeed: number
  icon: string
}

export async function getWeather(
  lat: number,
  lng: number
): Promise<WeatherData> {
  const apiKey = process.env['OPENWEATHER_API_KEY']
  if (!apiKey) throw new Error('OpenWeather API key not configured')

  const res = await fetch(
    `${OW_BASE_URL}/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`
  )
  if (!res.ok) throw new Error(`OpenWeather request failed: ${res.status}`)

  const data = (await res.json()) as {
    main: { temp: number; humidity: number }
    weather: Array<{ description: string; icon: string }>
    wind: { speed: number }
  }

  return {
    temp: data.main.temp,
    description: data.weather[0]?.description ?? '',
    humidity: data.main.humidity,
    windSpeed: data.wind.speed,
    icon: data.weather[0]?.icon ?? '',
  }
}

export async function getWeatherByCity(city: string): Promise<WeatherData> {
  const apiKey = process.env['OPENWEATHER_API_KEY']
  if (!apiKey) throw new Error('OpenWeather API key not configured')

  const res = await fetch(
    `${OW_BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
  )
  if (!res.ok) throw new Error(`OpenWeather request failed: ${res.status}`)

  const data = (await res.json()) as {
    main: { temp: number; humidity: number }
    weather: Array<{ description: string; icon: string }>
    wind: { speed: number }
  }

  return {
    temp: data.main.temp,
    description: data.weather[0]?.description ?? '',
    humidity: data.main.humidity,
    windSpeed: data.wind.speed,
    icon: data.weather[0]?.icon ?? '',
  }
}
