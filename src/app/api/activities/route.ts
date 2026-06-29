import { NextResponse } from 'next/server'
import { searchActivities } from '@/lib/api/viator'
import { z } from 'zod'

const schema = z.object({
  destination: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const parsed = schema.safeParse({
    destination: searchParams.get('destination'),
    date: searchParams.get('date'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const response = await searchActivities(
    parsed.data.destination,
    parsed.data.date
  )
  return NextResponse.json(response)
}
