import Anthropic from '@anthropic-ai/sdk'
import { requireEnv } from '@/lib/utils/env'
import { logAiUsage } from './usageLog'

/**
 * Cliente de IA unificado con switch por env var.
 *
 *   AI_PROVIDER=anthropic  -> usa Claude (producción)
 *   AI_PROVIDER=groq       -> usa Groq gratis (pruebas / desarrollo)
 *
 * Expone la misma interfaz que el SDK de Anthropic
 * (`aiClient.messages.create(...)`) y siempre devuelve una respuesta con
 * forma Anthropic: `{ content: [{ type: 'text', text }] }`. Cada llamada se
 * registra en ai_logs (tokens, costo, latencia) para el panel de admin.
 */

type Provider = 'anthropic' | 'groq'

function getProvider(): Provider {
  const raw = (process.env.AI_PROVIDER ?? 'anthropic').toLowerCase()
  return raw === 'groq' ? 'groq' : 'anthropic'
}

export interface AiTextBlock {
  type: 'text'
  text: string
}

export interface AiMessage {
  content: AiTextBlock[]
}

type CreateParams = Anthropic.Messages.MessageCreateParamsNonStreaming & {
  /** Fuerza salida JSON en proveedores que lo soportan (Groq). */
  jsonMode?: boolean
}

interface ProviderResult {
  message: AiMessage
  model: string
  promptTokens: number
  completionTokens: number
}

// ---------------------------------------------------------------------------
// Anthropic (producción)
// ---------------------------------------------------------------------------

let anthropicSingleton: Anthropic | null = null

function getAnthropic(): Anthropic {
  anthropicSingleton ??= new Anthropic()
  return anthropicSingleton
}

async function createWithAnthropic(
  params: CreateParams
): Promise<ProviderResult> {
  // jsonMode es específico de Groq; Anthropic no lo acepta.
  const { jsonMode: _jsonMode, ...anthropicParams } = params
  const message = await getAnthropic().messages.create(anthropicParams)
  const content: AiTextBlock[] = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => ({ type: 'text', text: b.text }))
  return {
    message: {
      content: content.length > 0 ? content : [{ type: 'text', text: '' }],
    },
    model: String(params.model),
    promptTokens: message.usage.input_tokens,
    completionTokens: message.usage.output_tokens,
  }
}

// ---------------------------------------------------------------------------
// Groq (pruebas) — API compatible con OpenAI, vía fetch para no añadir deps
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

function systemToString(system: CreateParams['system']): string | null {
  if (!system) return null
  if (typeof system === 'string') return system
  return system.map((b) => b.text).join('\n')
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

function groqModel(hasImage: boolean): string {
  return hasImage
    ? (process.env.GROQ_VISION_MODEL ??
        'meta-llama/llama-4-scout-17b-16e-instruct')
    : (process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile')
}

async function createWithGroq(params: CreateParams): Promise<ProviderResult> {
  const messages: OpenAIMessage[] = []
  let hasImage = false

  const system = systemToString(params.system)
  if (system) messages.push({ role: 'system', content: system })

  for (const m of params.messages) {
    const { parts, hasImage: imgInMsg } = translateContent(m.content)
    if (imgInMsg) hasImage = true
    messages.push({ role: m.role, content: parts })
  }

  const model = groqModel(hasImage)

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${requireEnv('GROQ_API_KEY')}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: params.max_tokens,
      messages,
      // Groq soporta JSON mode (incompatible con imágenes).
      ...(params.jsonMode && !hasImage
        ? { response_format: { type: 'json_object' } }
        : {}),
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Groq request failed (${res.status}): ${detail}`)
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const text = json.choices?.[0]?.message?.content ?? ''
  return {
    message: { content: [{ type: 'text', text }] },
    model,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Reintento ante rate-limit (429)
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms))

/** Segundos a esperar según el mensaje "try again in Xs" del proveedor. */
function retryDelayMs(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err)
  if (!/429|rate.?limit|rate_limit/i.test(msg)) return null
  const m = msg.match(/try again in ([\d.]+)\s*s/i)
  const secs = m?.[1] ? Number(m[1]) : 5
  // Solo reintentamos esperas cortas; si pide minutos, fallamos rápido para no
  // agotar el tiempo máximo de la función serverless.
  if (secs > 15) return null
  return Math.ceil(secs * 1000) + 500
}

// ---------------------------------------------------------------------------
// Interfaz pública (con logging de uso)
// ---------------------------------------------------------------------------

export const aiClient = {
  messages: {
    async create(params: CreateParams): Promise<AiMessage> {
      const provider = getProvider()
      const start = Date.now()
      try {
        const callProvider = (): Promise<ProviderResult> =>
          provider === 'groq'
            ? createWithGroq(params)
            : createWithAnthropic(params)

        let result: ProviderResult
        try {
          result = await callProvider()
        } catch (err) {
          const delay = retryDelayMs(err)
          if (delay === null) throw err
          await sleep(delay)
          result = await callProvider()
        }
        void logAiUsage({
          provider,
          model: result.model,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          latencyMs: Date.now() - start,
          success: true,
        })
        return result.message
      } catch (err) {
        void logAiUsage({
          provider,
          model: provider === 'groq' ? groqModel(false) : String(params.model),
          promptTokens: 0,
          completionTokens: 0,
          latencyMs: Date.now() - start,
          success: false,
          error: err instanceof Error ? err.message : 'unknown',
        })
        throw err
      }
    },
  },
}
