import { aiClient } from '@/lib/ai/client'
import { extractJson } from '@/lib/ai/extractJson'
import { z } from 'zod'
import type { AlertMessage } from '@/types/alerts'

export const maxDuration = 30

const Schema = z.object({
  prompt: z.string().min(10).max(4000),
})

const fallback: AlertMessage = {
  mensajeAmigable:
    'Llevas un poco de retraso, pero todavía puedes recuperarlo.',
  actividadRecomendarQuitar: null,
  razonSimple: '',
  tiempoQueAhorra: 0,
  alternativa: null,
}

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json()
  const parsed = Schema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const message = await aiClient.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system:
      'Responde SOLO con JSON válido. Sin texto extra, sin markdown, sin explicaciones.',
    messages: [{ role: 'user', content: parsed.data.prompt }],
  })

  const text =
    (
      message.content.find((b) => b.type === 'text') as
        | { type: 'text'; text: string }
        | undefined
    )?.text ?? ''

  try {
    const result = extractJson<AlertMessage>(text)
    return Response.json(result)
  } catch {
    return Response.json(fallback)
  }
}
