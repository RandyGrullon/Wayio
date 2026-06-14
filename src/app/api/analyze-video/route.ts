import { NextResponse } from 'next/server'
import {
  analyzeVideoFromUrl,
  analyzeVideoFromBase64,
} from '@/lib/ai/analyzeVideo'
import type { VideoAnalysisResult } from '@/lib/ai/analyzeVideo'
import { aiConfigured } from '@/lib/ai/config'
import { z } from 'zod'

const urlSchema = z.object({
  videoUrl: z.string().url(),
})

const base64Schema = z.object({
  imageBase64: z.string().min(1),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

const DEMO_VIDEO_RESULT: VideoAnalysisResult = {
  lugares: [
    {
      lugar: 'Tokio',
      pais: 'Japón',
      region: 'Kanto',
      tipo: 'ciudad',
      actividades: ['templos', 'gastronomía', 'compras'],
      confianza: 0.9,
    },
  ],
  destinoSugerido: 'Tokio',
  resumen:
    'Demo: sin API key de IA mostramos un resultado de ejemplo (Tokio). Configura la IA para analizar videos reales.',
}

export const maxDuration = 120

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json()

  // Modo demo: sin IA devolvemos un análisis de ejemplo
  if (!aiConfigured()) {
    return NextResponse.json(DEMO_VIDEO_RESULT)
  }

  const urlParsed = urlSchema.safeParse(body)
  if (urlParsed.success) {
    const result = await analyzeVideoFromUrl(urlParsed.data.videoUrl)
    return NextResponse.json(result)
  }

  const b64Parsed = base64Schema.safeParse(body)
  if (b64Parsed.success) {
    const result = await analyzeVideoFromBase64(
      b64Parsed.data.imageBase64,
      b64Parsed.data.mediaType
    )
    return NextResponse.json(result)
  }

  return NextResponse.json(
    { error: 'Envía videoUrl o imageBase64+mediaType' },
    { status: 400 }
  )
}
