import Anthropic from '@anthropic-ai/sdk'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffmpeg from 'fluent-ffmpeg'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

const execAsync = promisify(exec)
const client = new Anthropic()

const VISION_PROMPT = `Analiza este frame de video de viaje. Identifica con confianza >= 0.7:
- Nombre del lugar (ciudad, landmark, restaurante, hotel, etc.)
- País y región
- Tipo de lugar (museo, playa, restaurante, barrio, etc.)
- Actividades posibles

Responde SOLO con JSON válido:
{"lugar": string, "pais": string, "region": string, "tipo": string, "actividades": string[], "confianza": number}
Si no identificas un lugar con confianza >= 0.7 responde: {"lugar": null}`

export interface PlaceFromVideo {
  lugar: string
  pais: string
  region: string
  tipo: string
  actividades: string[]
  confianza: number
}

export interface VideoAnalysisResult {
  lugares: PlaceFromVideo[]
  destinoSugerido: string
  resumen: string
}

async function downloadVideo(url: string, destDir: string): Promise<string> {
  const ytDlpExec = await import('yt-dlp-exec')
  const ytDlp = ytDlpExec.default
  const outPath = path.join(destDir, 'video.%(ext)s')
  await ytDlp(url, {
    output: outPath,
    format: 'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
    noPlaylist: true,
  })
  const files = fs.readdirSync(destDir).filter((f) => f.startsWith('video.'))
  const videoFile = files[0]
  if (!videoFile) throw new Error('No se descargó el video')
  return path.join(destDir, videoFile)
}

async function extractFrames(
  videoPath: string,
  framesDir: string,
  fps = 0.1
): Promise<string[]> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([`-vf fps=${fps}`, '-q:v 2'])
      .output(path.join(framesDir, 'frame-%03d.jpg'))
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run()
  })
  return fs
    .readdirSync(framesDir)
    .filter((f) => f.endsWith('.jpg'))
    .sort()
    .map((f) => path.join(framesDir, f))
}

async function analyzeFrameBatch(
  framePaths: string[]
): Promise<PlaceFromVideo[]> {
  const content: Anthropic.MessageParam['content'] = []

  for (const fp of framePaths) {
    const data = fs.readFileSync(fp).toString('base64')
    content.push(
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data },
      },
      { type: 'text', text: VISION_PROMPT }
    )
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content }],
  })

  const text =
    message.content[0]?.type === 'text' ? message.content[0].text : ''
  const matches = text.matchAll(/\{[^{}]*"lugar"[^{}]*\}/g)
  const results: PlaceFromVideo[] = []
  for (const m of matches) {
    try {
      const parsed = JSON.parse(m[0]) as {
        lugar: string | null
        pais?: string
        region?: string
        tipo?: string
        actividades?: string[]
        confianza?: number
      }
      if (parsed.lugar && (parsed.confianza ?? 0) >= 0.7) {
        results.push({
          lugar: parsed.lugar,
          pais: parsed.pais ?? '',
          region: parsed.region ?? '',
          tipo: parsed.tipo ?? 'actividad',
          actividades: parsed.actividades ?? [],
          confianza: parsed.confianza ?? 0.7,
        })
      }
    } catch {
      // skip malformed
    }
  }
  return results
}

function deduplicatePlaces(places: PlaceFromVideo[]): PlaceFromVideo[] {
  const seen = new Set<string>()
  return places.filter((p) => {
    const key = p.lugar.toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function consolidatePlaces(
  lugares: PlaceFromVideo[]
): Promise<{ destinoSugerido: string; resumen: string }> {
  if (lugares.length === 0) {
    return {
      destinoSugerido: 'Destino desconocido',
      resumen: 'No se identificaron lugares en el video.',
    }
  }
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Dado estos lugares identificados en un video de viaje: ${JSON.stringify(lugares.map((l) => l.lugar))}
¿Cuál sería el destino principal y un resumen breve del viaje?
Responde SOLO con JSON: {"destinoSugerido": string, "resumen": string}`,
      },
    ],
  })
  const text =
    message.content[0]?.type === 'text' ? message.content[0].text : ''
  const match = text.match(/\{[^{}]*"destinoSugerido"[^{}]*\}/)
  if (match?.[0]) {
    const r = JSON.parse(match[0]) as {
      destinoSugerido: string
      resumen: string
    }
    return r
  }
  return {
    destinoSugerido: lugares[0]?.lugar ?? 'Destino',
    resumen: `Viaje con ${lugares.length} lugares identificados.`,
  }
}

export async function analyzeVideoFromUrl(
  url: string
): Promise<VideoAnalysisResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tripmind-video-'))
  const framesDir = path.join(tmpDir, 'frames')
  fs.mkdirSync(framesDir)

  try {
    const videoPath = await downloadVideo(url, tmpDir)
    const framePaths = await extractFrames(videoPath, framesDir, 0.1)

    // Process in batches of 10
    const allPlaces: PlaceFromVideo[] = []
    for (let i = 0; i < framePaths.length; i += 10) {
      const batch = framePaths.slice(i, i + 10)
      const places = await analyzeFrameBatch(batch)
      allPlaces.push(...places)
    }

    const unique = deduplicatePlaces(allPlaces)
    const { destinoSugerido, resumen } = await consolidatePlaces(unique)
    return { lugares: unique, destinoSugerido, resumen }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

export async function analyzeVideoFromBase64(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<VideoAnalysisResult> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          { type: 'text', text: VISION_PROMPT },
        ],
      },
    ],
  })

  const text =
    message.content[0]?.type === 'text' ? message.content[0].text : ''
  const match = text.match(/\{[^{}]*"lugar"[^{}]*\}/)
  let lugar: PlaceFromVideo | null = null
  if (match?.[0]) {
    try {
      const parsed = JSON.parse(match[0]) as {
        lugar: string | null
        pais?: string
        region?: string
        tipo?: string
        actividades?: string[]
        confianza?: number
      }
      if (parsed.lugar && (parsed.confianza ?? 0) >= 0.7) {
        lugar = {
          lugar: parsed.lugar,
          pais: parsed.pais ?? '',
          region: parsed.region ?? '',
          tipo: parsed.tipo ?? 'actividad',
          actividades: parsed.actividades ?? [],
          confianza: parsed.confianza ?? 0.7,
        }
      }
    } catch {
      // ignore
    }
  }

  const lugares = lugar ? [lugar] : []
  const { destinoSugerido, resumen } = await consolidatePlaces(lugares)
  return { lugares, destinoSugerido, resumen }
}

// Legacy compatibility export
export async function analyzeVideo(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<VideoAnalysisResult> {
  return analyzeVideoFromBase64(imageBase64, mediaType)
}

// Used for background commands (unused import guard)
void execAsync
