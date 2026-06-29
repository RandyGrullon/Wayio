import { NextResponse } from 'next/server'
import { searchHotels } from '@/lib/api/booking'
import { z } from 'zod'

const schema = z.object({
  destination: z.string().min(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().positive().max(20),
})

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const parsed = schema.safeParse({
    destination: searchParams.get('destination'),
    checkIn: searchParams.get('checkIn'),
    checkOut: searchParams.get('checkOut'),
    guests: Number(searchParams.get('guests') ?? '1'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { destination, checkIn, checkOut, guests } = parsed.data
  const response = await searchHotels(destination, checkIn, checkOut, guests)
  return NextResponse.json(response)
}
