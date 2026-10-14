import Anthropic from '@anthropic-ai/sdk'
import { after } from 'next/server'
import { requireEnv } from '@/lib/utils/env'
import {
  aiEffort,
  aiModel,
  aiProvider,
  type AiProvider,
  type AiTask,
} from './config'
import { logAiUsage } from './usageLog'

/**
 * Cliente de IA unificado (Anthropic en producción, Groq para pruebas).
 *
 *   AI_PROVIDER=anthropic  -> Claude (por defecto)
 *   AI_PROVIDER=groq       -> Groq (API compatible con OpenAI)
 *
 * Punto de entrada: `aiGenerate()`. Con `schema` la respuesta es JSON que
 * cumple ese JSON Schema (structured outputs en Anthropic; JSON mode en Groq).
 * Siempre devuelve `stopReason` para detectar truncamientos (max_tokens), y
 * registra cada llamada en ai_logs (tokens, coste, latencia, endpoint).
 */

export type AiStopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'refusal'
  | 'stop_sequence'
  | 'other'

export interface AiRequest {
  /** Tarea: decide modelo y esfuerzo (ver config.ts). */
  task: AiTask
  system?: string
  messages: Anthropic.MessageParam[]
  maxTokens: number
  /** JSON Schema de la salida. Si se pasa, `text` es JSON válido. */
  schema?: Record<string, unknown>
  /** Ruta o función que hace la llamada, para el panel de costes. */
  endpoint?: string
  userId?: string | null
  signal?: AbortSignal
  /** Tiempo máximo de la petición (ms). Por defecto 280 s. */
  timeoutMs?: number
  /** Fuerza un modelo concreto (por defecto lo decide `task`). */
  model?: string
}

export interface AiResult {
  text: string
  stopReason: AiStopReason
  provider: AiProvider
  /** Modelo que respondió realmente (puede diferir si hubo fallback). */
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

/** La IA se negó a responder (clasificadores de seguridad). */
export class AiRefusalError extends Error {
  constructor(message = 'La IA rechazó la solicitud') {
    super(message)
    this.name = 'AiRefusalError'
  }
}

/** Error HTTP de Groq con su status. */
export class GroqHttpError extends Error {
  readonly status: number
  constructor(status: number, detail: string) {
    super(`Groq request failed (${status}): ${detail.slice(0, 500)}`)
    this.name = 'GroqHttpError'
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

let anthropicSingleton: Anthropic | null = null

function getAnthropic(): Anthropic {
  anthropicSingleton ??= new Anthropic()
  return anthropicSingleton
}

/**
 * Modelos que aceptan el fallback del lado del servidor ante un rechazo de los
 * clasificadores (fallbacks: "default"). Para el resto se omite.
 */
const FALLBACK_MODELS = new Set([
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
  'claude-fable-5-1',
])

function mapAnthropicStop(reason: string | null | undefined): AiStopReason {
  switch (reason) {
    case 'end_turn':
    case 'max_tokens':
    case 'refusal':
    case 'stop_sequence':
      return reason
    default:
      return 'other'
  }
}

async function callAnthropic(
  req: AiRequest,
  model: string
): Promise<Omit<AiResult, 'latencyMs'>> {
  const client = getAnthropic()
  const outputConfig: Anthropic.Beta.Messages.BetaOutputConfig = {
    effort: aiEffort(req.task),
    ...(req.schema
      ? { format: { type: 'json_schema' as const, schema: req.schema } }
      : {}),
  }
  const withFallback = FALLBACK_MODELS.has(model)

  // Siempre en streaming: los itinerarios largos generan muchos tokens y el
  // SDK exige streaming para max_tokens altos (evita timeouts HTTP).
  const stream = client.beta.messages.stream(
    {
      model,
      max_tokens: req.maxTokens,
      ...(req.system ? { system: req.system } : {}),
      messages: req.messages as Anthropic.Beta.Messages.BetaMessageParam[],
      output_config: outputConfig,
      ...(withFallback
        ? {
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default' as const,
          }
        : {}),
    },
    {
      timeout: req.timeoutMs ?? 280_000,
      ...(req.signal ? { signal: req.signal } : {}),
    }
  )
  const message = await stream.finalMessage()

  const stopReason = mapAnthropicStop(message.stop_reason)
  if (stopReason === 'refusal') throw new AiRefusalError()

  const text = message.content
    .filter(
      (b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text'
    )
    .map((b) => b.text)
    .join('')

  return {
    text,
    stopReason,
    provider: 'anthropic',
    model: message.model || model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  }
}

// ---------------------------------------------------------------------------
// Groq (API compatible con OpenAI, vía fetch para no añadir dependencias)
// ---------------------------------------------------------------------------

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

interface OpenAIContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | OpenAIContentPart[]
}

function translateContent(content: Anthropic.MessageParam['content']): {
  parts: string | OpenAIContentPart[]
  hasImage: boolean
} {
  if (typeof content === 'string') return { parts: content, hasImage: false }
  let hasImage = false
  const parts: OpenAIContentPart[] = []
  for (const block of content) {
    if (block.type === 'text') {
      parts.push({ type: 'text', text: block.text })
    } else if (block.type === 'image' && block.source.type === 'base64') {
      hasImage = true
      const { media_type, data } = block.source
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${media_type};base64,${data}` },
      })
    }
  }
  return { parts, hasImage }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms))

async function callGroq(
  req: AiRequest,
  model: string
): Promise<Omit<AiResult, 'latencyMs'>> {
  const messages: OpenAIMessage[] = []
  // El JSON mode de Groq exige que el prompt mencione "JSON".
  const jsonHint = req.schema
    ? `\n\nResponde ÚNICAMENTE con un objeto JSON válido que cumpla este JSON Schema:\n${JSON.stringify(req.schema)}`
    : ''
  if (req.system || jsonHint) {
    messages.push({ role: 'system', content: `${req.system ?? ''}${jsonHint}` })
  }
  for (const m of req.messages) {
    messages.push({ role: m.role, content: translateContent(m.content).parts })
  }

  const isReasoning = model.startsWith('openai/gpt-oss')
  const body = JSON.stringify({
    model,
    max_completion_tokens: req.maxTokens,
    messages,
    ...(req.schema ? { response_format: { type: 'json_object' } } : {}),
    ...(isReasoning ? { reasoning_effort: aiEffort(req.task) } : {}),
  })

  const doFetch = async (): Promise<Response> =>
    fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requireEnv('GROQ_API_KEY')}`,
      },
      body,
      signal: req.signal ?? AbortSignal.timeout(req.timeoutMs ?? 280_000),
    })

  let res = await doFetch()
  // Un reintento ante límite por minuto corto o error transitorio.
  if (res.status === 429 || res.status >= 500) {
    const retryAfter = Number(res.headers.get('retry-after'))
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 3000
    if (waitMs <= 15_000) {
      await sleep(waitMs + 250)
      res = await doFetch()
    }
  }
  if (!res.ok) throw new GroqHttpError(res.status, await res.text())

  const json = (await res.json()) as {
    model?: string
    choices?: {
      finish_reason?: string
      message?: { content?: string | null }
    }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const choice = json.choices?.[0]
  const finish = choice?.finish_reason
  return {
    text: choice?.message?.content ?? '',
    stopReason:
      finish === 'length'
        ? 'max_tokens'
        : finish === 'stop'
          ? 'end_turn'
          : 'other',
    provider: 'groq',
    model: json.model ?? model,
    inputTokens: json.usage?.prompt_tokens ?? 0,
    outputTokens: json.usage?.completion_tokens ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Interfaz pública
// ---------------------------------------------------------------------------

/** Registra el uso tras responder (after) o en segundo plano fuera de una petición. */
function logLater(entry: Parameters<typeof logAiUsage>[0]): void {
  try {
    after(() => logAiUsage(entry))
  } catch {
    void logAiUsage(entry)
  }
}

export async function aiGenerate(req: AiRequest): Promise<AiResult> {
  const provider = aiProvider()
  const model = req.model ?? aiModel(req.task)
  const start = Date.now()
  try {
    const r =
      provider === 'groq'
        ? await callGroq(req, model)
        : await callAnthropic(req, model)
    const latencyMs = Date.now() - start
    logLater({
      provider,
      model: r.model,
      endpoint: req.endpoint ?? req.task,
      userId: req.userId ?? null,
      promptTokens: r.inputTokens,
      completionTokens: r.outputTokens,
      latencyMs,
      success: r.stopReason !== 'max_tokens',
      ...(r.stopReason === 'max_tokens' ? { error: 'max_tokens' } : {}),
    })
    return { ...r, latencyMs }
  } catch (err) {
    logLater({
      provider,
      model,
      endpoint: req.endpoint ?? req.task,
      userId: req.userId ?? null,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: Date.now() - start,
      success: false,
      error: err instanceof Error ? err.message.slice(0, 500) : 'unknown',
    })
    throw err
  }
}

export type AiErrorCode =
  | 'rate_limit'
  | 'auth'
  | 'model'
  | 'refusal'
  | 'timeout'
  | 'truncated'
  | 'network'
  | 'unknown'

/**
 * Clasifica un error de IA para decidir el mensaje al usuario. El detalle
 * técnico va a Sentry/logs; al usuario solo se le muestra `mensaje`.
 */
export function describeAiError(err: unknown): {
  code: AiErrorCode
  mensaje: string
} {
  if (err instanceof AiRefusalError) {
    return {
      code: 'refusal',
      mensaje:
        'No pudimos planificar ese viaje tal como está descrito. Prueba a reformular la descripción.',
    }
  }
  const status =
    err instanceof Anthropic.APIError
      ? err.status
      : err instanceof GroqHttpError
        ? err.status
        : undefined
  if (err instanceof Anthropic.RateLimitError || status === 429) {
    return {
      code: 'rate_limit',
      mensaje:
        'Hay mucha demanda en este momento. Espera unos segundos y vuelve a intentarlo.',
    }
  }
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError ||
    status === 401 ||
    status === 403
  ) {
    return {
      code: 'auth',
      mensaje:
        'El servicio de IA no está disponible ahora mismo. Inténtalo más tarde.',
    }
  }
  if (err instanceof Anthropic.NotFoundError || status === 404) {
    return {
      code: 'model',
      mensaje:
        'El servicio de IA no está disponible ahora mismo. Inténtalo más tarde.',
    }
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return {
      code: 'timeout',
      mensaje:
        'La IA tardó demasiado en responder. Prueba con un viaje más corto o vuelve a intentarlo.',
    }
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return {
      code: 'network',
      mensaje:
        'No pudimos conectar con la IA. Revisa tu conexión e inténtalo de nuevo.',
    }
  }
  if (err instanceof Error && /max_tokens|truncad/i.test(err.message)) {
    return {
      code: 'truncated',
      mensaje:
        'El itinerario salió demasiado largo. Vuelve a intentarlo o acorta el viaje.',
    }
  }
  return {
    code: 'unknown',
    mensaje:
      'La IA no pudo generar la respuesta en este momento. Inténtalo de nuevo.',
  }
}

/** Texto de la primera respuesta de un bloque de mensajes estilo Anthropic. */
export interface AiTextBlock {
  type: 'text'
  text: string
}

export interface AiMessage {
  content: AiTextBlock[]
  stopReason: AiStopReason
}

type LegacyCreateParams = {
  model?: string
  max_tokens: number
  system?: string
  messages: Anthropic.MessageParam[]
  /** Fuerza salida JSON (antes solo Groq). */
  jsonMode?: boolean
  task?: AiTask
  endpoint?: string
}

/**
 * Interfaz antigua (`aiClient.messages.create`) que siguen usando algunas
 * rutas. Delega en aiGenerate. Código nuevo: usar aiGenerate directamente.
 */
export const aiClient = {
  messages: {
    async create(params: LegacyCreateParams): Promise<AiMessage> {
      const r = await aiGenerate({
        task: params.task ?? 'rapido',
        ...(params.model && aiProvider() === 'anthropic'
          ? { model: params.model }
          : {}),
        maxTokens: params.max_tokens,
        ...(params.system ? { system: params.system } : {}),
        messages: params.messages,
        ...(params.endpoint ? { endpoint: params.endpoint } : {}),
      })
      return {
        content: [{ type: 'text', text: r.text }],
        stopReason: r.stopReason,
      }
    },
  },
}
