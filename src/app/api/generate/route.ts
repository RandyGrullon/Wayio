import Anthropic from '@anthropic-ai/sdk'
import { TripFormSchema } from '@/lib/validations/tripForm'
import type { TripForm } from '@/lib/validations/tripForm'
import { buildItineraryPrompt } from '@/lib/ai/generateItinerary'
import { searchFlights } from '@/lib/api/amadeus'
import { searchHotels } from '@/lib/api/booking'
import { searchActivities } from '@/lib/api/viator'
import { getWeatherByCity } from '@/lib/api/openweather'
import type { WeatherData } from '@/lib/api/openweather'
import { getTravelTimes } from '@/lib/api/googlemaps'
import { getCachedTrip, saveCachedTrip } from '@/lib/cache/tripCache'
import type { Trip, Day } from '@/types/trip'
import type { Activity } from '@/types/activity'

export const maxDuration = 60

const anthropic = new Anthropic()

export interface GenerateResult {
  basico: Trip
  confort: Trip
  premium: Trip
  weather: WeatherData | null
}

async function buscarVuelos(form: TripForm): Promise<unknown> {
  try {
    return await searchFlights(
      form.origen,
      form.destino,
      form.fechaInicio,
      form.personas
    )
  } catch {
    return null
  }
}

async function buscarHoteles(form: TripForm): Promise<unknown> {
  try {
    return await searchHotels(
      form.destino,
      form.fechaInicio,
      form.fechaFin,
      form.personas
    )
  } catch {
    return null
  }
}

async function buscarActividades(form: TripForm): Promise<unknown> {
  try {
    return await searchActivities(form.destino, form.fechaInicio)
  } catch {
    return null
  }
}

async function buscarClima(form: TripForm): Promise<WeatherData | null> {
  try {
    return await getWeatherByCity(form.destino)
  } catch {
    return null
  }
}

async function enrichDayWithTravelTimes(day: Day): Promise<Day> {
  if (day.actividades.length < 2) return day
  try {
    const times = await getTravelTimes(day.actividades)
    const enriched: Activity[] = day.actividades.map((act, i) => ({
      ...act,
      tiempoHastaSiguiente: times[i] ?? act.tiempoHastaSiguiente,
    }))
    return { ...day, actividades: enriched }
  } catch {
    return day
  }
}

async function generatePackage(
  form: TripForm,
  paquete: 'basico' | 'confort' | 'premium'
): Promise<Trip> {
  const formWithPaquete: TripForm = { ...form, paquete }
  const prompt = buildItineraryPrompt(formWithPaquete)

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text =
    (
      message.content.find((b) => b.type === 'text') as
        | { type: 'text'; text: string }
        | undefined
    )?.text ?? '{}'

  const partial = JSON.parse(text) as Omit<
    Trip,
    | 'id'
    | 'origen'
    | 'personas'
    | 'fechaInicio'
    | 'fechaFin'
    | 'paquete'
    | 'listaActividades'
    | 'actividadesPendientes'
  >

  // Enrich each day's activities with real Google Maps travel times in parallel
  const enrichedDias = await Promise.all(
    partial.dias.map(enrichDayWithTravelTimes)
  )

  return {
    ...partial,
    dias: enrichedDias,
    id: crypto.randomUUID(),
    origen: form.origen,
    personas: form.personas,
    fechaInicio: form.fechaInicio,
    fechaFin: form.fechaFin,
    paquete,
    listaActividades: [],
    actividadesPendientes: [],
  }
}

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json()
  const parsed = TripFormSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const form = parsed.data

  const cached = await getCachedTrip(form)
  if (cached) {
    return new Response(cached, {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    })
  }

  // Fire all external searches + 3 Claude generations in parallel
  const [, , , weather, basico, confort, premium] = await Promise.all([
    buscarVuelos(form),
    buscarHoteles(form),
    buscarActividades(form),
    buscarClima(form),
    generatePackage(form, 'basico'),
    generatePackage(form, 'confort'),
    generatePackage(form, 'premium'),
  ])

  const result: GenerateResult = {
    basico: basico as Trip,
    confort: confort as Trip,
    premium: premium as Trip,
    weather: weather as WeatherData | null,
  }

  const json = JSON.stringify(result)
  await saveCachedTrip(form, json)

  return new Response(json, {
    headers: { 'Content-Type': 'application/json' },
  })
}
