import { NextResponse } from 'next/server'
import { searchFlights } from '@/lib/api/amadeus'
import { z } from 'zod'

const schema = z.object({
  origin: z.string().length(3),
  destination: z.string().length(3),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().positive().max(9),
})

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const parsed = schema.safeParse({
    origin: searchParams.get('origin'),
    destination: searchParams.get('destination'),
    date: searchParams.get('date'),
    adults: Number(searchParams.get('adults') ?? '1'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { origin, destination, date, adults } = parsed.data
  const response = await searchFlights(origin, destination, date, adults)
  return NextResponse.json(response)
}
