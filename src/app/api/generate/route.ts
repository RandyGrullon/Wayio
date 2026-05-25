import Anthropic from '@anthropic-ai/sdk'
import { TripFormSchema } from '@/lib/validations/tripForm'
import type { TripForm } from '@/lib/validations/tripForm'
import { buildItineraryPrompt } from '@/lib/ai/generateItinerary'
import { searchFlights } from '@/lib/api/amadeus'
import { searchHotels } from '@/lib/api/booking'
import { searchActivities } from '@/lib/api/viator'
import { getWeatherByCity } from '@/lib/api/openweather'
import { getCachedTrip, saveCachedTrip } from '@/lib/cache/tripCache'

const anthropic = new Anthropic()

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

async function buscarClima(form: TripForm): Promise<unknown> {
  try {
    return await getWeatherByCity(form.destino)
  } catch {
    return null
  }
}

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json()
  const parsed = TripFormSchema.safeParse(body)

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const form = parsed.data

  // Check Supabase cache first
  const cached = await getCachedTrip(form)
  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Cache': 'HIT',
      },
    })
  }

  // Fire all external searches in parallel — fail gracefully
  await Promise.all([
    buscarVuelos(form),
    buscarHoteles(form),
    buscarActividades(form),
    buscarClima(form),
  ])

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: buildItineraryPrompt(form) }],
  })

  const encoder = new TextEncoder()
  let accumulated = ''

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            accumulated += event.delta.text
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        await saveCachedTrip(form, accumulated)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
