import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import {
  analyzeImage,
  analyzeVideoFromUrl,
  normalizarUrlVideo,
  prepararImagen,
  VideoAnalysisError,
  videoAnalysisEnabled,
  type VideoAnalysisResult,
} from '@/lib/ai/analyzeVideo'
import { describeAiError } from '@/lib/ai/client'
import { aiConfigured } from '@/lib/ai/config'
import { bloqueoPorTopeDiario, respuestaTopeDiario } from '@/lib/ai/presupuesto'
import {
  estadoPorErrorIA,
  exigirSesion,
  jsonError,
  leerJson,
  limitarIa,
} from '@/lib/ai/routeKit'
import { exigirCupo } from '@/lib/planes/cupo'
import {
  LIMITES_ANALIZAR_IMAGEN,
  LIMITES_ANALIZAR_VIDEO,
} from '@/lib/security/aiGuard'

/**
 * POST /api/analyze-video — detecta lugares en un video de viaje o en una foto.
 *
 * Body (una de dos):
 *   { videoUrl: string }                       (YouTube, TikTok, Instagram, Vimeo, Facebook)
 *   { imageBase64: string, mediaType?: 'image/jpeg'|'image/png'|'image/webp' }  (≤ 5 MB)
 * 200: VideoAnalysisResult { lugares, destinoSugerido, resumen, demo?, parcial? }
 *
 * Exige sesión (antes de leer el body de hasta 5 MB), tiene límites por
 * cuenta por hora y por día y respeta el tope global de gasto diario (429
 * code 'tope_diario'; el resultado de ejemplo sin IA nunca se bloquea). En
 * el plan Gratis, fotos y videos comparten el cupo mensual 'analizar' (402
 * code 'cupo_agotado', ver src/lib/planes/cupo.ts); un análisis que falla no
 * lo gasta. El modo video depende del flag VIDEO_ANALYSIS_ENABLED
 * (desactivado por defecto en producción): desactivado, su 503 llega antes
 * de tocar el cupo.
 */

export const maxDuration = 300

/** Presupuesto de tiempo interno (por debajo de maxDuration). */
const PRESUPUESTO_MS = 280_000
/** 5 MB de foto en base64 + margen del JSON. */
const MAX_BODY_BYTES = 5_400_000

const UrlBody = z.object({ videoUrl: z.string().trim().min(4).max(2048) })
const ImagenBody = z.object({
  imageBase64: z.string().min(16),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
})

const DEMO_RESULT: VideoAnalysisResult = {
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
  destinoSugerido: 'Tokio, Japón',
  resumen:
    'Este es un resultado de ejemplo: el análisis con IA no está disponible ahora mismo.',
  demo: true,
}

function respuestaDeError(err: unknown): Response {
  if (err instanceof VideoAnalysisError && err.code === 'tope_diario') {
    // Corte duro del tope a mitad del análisis (aiGenerate).
    return respuestaTopeDiario()
  }
  if (err instanceof VideoAnalysisError) {
    if (err.code === 'herramientas' || err.status >= 500) {
      Sentry.captureException(err, { tags: { area: 'analyze-video' } })
    }
    return jsonError(err.status, err.mensaje, { code: err.code })
  }
  const { code } = describeAiError(err)
  Sentry.captureException(err, { tags: { area: 'analyze-video' } })
  return jsonError(
    estadoPorErrorIA(code),
    'No pudimos analizar el video en este momento. Inténtalo de nuevo en unos minutos.',
    { code }
  )
}

export async function POST(request: Request): Promise<Response> {
  const inicio = Date.now()
  const sesion = await exigirSesion(request)
  if (!sesion.ok) return sesion.response

  const lectura = await leerJson(request, MAX_BODY_BYTES)
  if (!lectura.ok) return lectura.response

  const comoUrl = UrlBody.safeParse(lectura.data)
  const comoImagen = comoUrl.success ? null : ImagenBody.safeParse(lectura.data)

  // ── Modo video (URL) ────────────────────────────────────────────────────
  if (comoUrl.success) {
    if (!videoAnalysisEnabled()) {
      return jsonError(
        503,
        'El análisis de videos no está disponible por ahora. Puedes escribir el destino o subir una foto del lugar.',
        { code: 'video_desactivado' }
      )
    }
    let url: string
    try {
      url = normalizarUrlVideo(comoUrl.data.videoUrl)
    } catch (err) {
      return respuestaDeError(err)
    }

    const limite = await limitarIa(
      sesion.llamante,
      'analyze-video',
      LIMITES_ANALIZAR_VIDEO
    )
    if (limite) return limite

    if (!aiConfigured()) return Response.json(DEMO_RESULT)

    // Antes de la descarga y ffmpeg, que también son caros.
    const tope = await bloqueoPorTopeDiario()
    if (tope) return tope

    const cupo = await exigirCupo(sesion.llamante, 'analizar')
    if (!cupo.ok) return cupo.response

    try {
      const resultado = await analyzeVideoFromUrl(url, {
        userId: sesion.llamante.user?.id ?? null,
        signal: request.signal,
        deadline: inicio + PRESUPUESTO_MS,
      })
      return Response.json(resultado)
    } catch (err) {
      await cupo.devolver()
      return respuestaDeError(err)
    }
  }

  // ── Modo foto (base64) ──────────────────────────────────────────────────
  if (!comoImagen?.success) {
    return jsonError(400, 'Envía el enlace de un video o una foto del lugar.', {
      code: 'bad_request',
    })
  }

  let imagen: ReturnType<typeof prepararImagen>
  try {
    imagen = prepararImagen(comoImagen.data.imageBase64)
  } catch (err) {
    return respuestaDeError(err)
  }

  const limite = await limitarIa(
    sesion.llamante,
    'analyze-image',
    LIMITES_ANALIZAR_IMAGEN
  )
  if (limite) return limite

  if (!aiConfigured()) return Response.json(DEMO_RESULT)

  const tope = await bloqueoPorTopeDiario()
  if (tope) return tope

  const cupo = await exigirCupo(sesion.llamante, 'analizar')
  if (!cupo.ok) return cupo.response

  try {
    const resultado = await analyzeImage(imagen, {
      userId: sesion.llamante.user?.id ?? null,
      signal: request.signal,
      deadline: inicio + PRESUPUESTO_MS,
    })
    return Response.json(resultado)
  } catch (err) {
    await cupo.devolver()
    return respuestaDeError(err)
  }
}
