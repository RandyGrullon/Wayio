import { NextResponse } from 'next/server'
import { validateSchedule } from '@/lib/ai/validateSchedule'
import type { Day } from '@/types/trip'

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as { dias: Day[] }

  if (!Array.isArray(body.dias)) {
    return NextResponse.json(
      { error: 'dias must be an array' },
      { status: 400 }
    )
  }

  const conflicts = await validateSchedule(body.dias)
  return NextResponse.json({ conflicts })
}
