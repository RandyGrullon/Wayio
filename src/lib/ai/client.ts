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
import { estimateCost } from './pricing'
import {
  corteDuroAlcanzado,
  MENSAJE_TOPE_DIARIO,
  registrarGastoLocal,
} from './presupuesto'
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

/**
 * Se alcanzó el tope global de gasto diario (corte duro, ver presupuesto.ts):
 * se lanza ANTES de llamar al proveedor, así que no cuesta nada.
 */
export class AiTopeDiarioError extends Error {
  constructor() {
    super('Tope diario de gasto de IA alcanzado')
    this.name = 'AiTopeDiarioError'
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

/**
 * Uso (tokens y coste estimado) de una llamada. En las que fallan (abortadas,
 * rechazadas, cortadas a mitad) es una estimación prudente: Anthropic cobra
 * la entrada ya procesada y la salida ya generada, y si se registrara 0 el
 * tope diario no vería ese gasto.
 */
interface UsoLlamada {
  inputTokens: number
  outputTokens: number
  costoUsd: number
}

const usoVacio = (): UsoLlamada => ({
  inputTokens: 0,
  outputTokens: 0,
  costoUsd: 0,
})

/**
 * Cota alta de la velocidad de salida (tokens/s, sin fast mode) para estimar
 * la salida (pensamiento incluido) de un stream cortado: con pensamiento
 * adaptativo el texto puede llegar vacío y el usage final solo viene al
 * terminar, así que el tiempo transcurrido es la medida fiable. Haiku es el
 * más rápido; para el resto, 150 tokens/s queda por encima de lo habitual.
 */
const tokensSalidaPorSegundo = (modelo: string): number =>
  /haiku/i.test(modelo) ? 300 : 150
/** Tokens prudentes por imagen (las de alta resolución rondan los 4.800). */
const TOKENS_POR_IMAGEN = 5_000
/** Caracteres por token prudentes (español; tokenizadores nuevos cuentan más). */
const CARACTERES_POR_TOKEN = 3

/**
 * Tokens de entrada estimados de la petición, para cuando el stream se corta
 * antes de message_start (que es el evento que trae input_tokens).
 */
function estimarTokensEntrada(req: AiRequest): number {
  let caracteres =
    (req.system?.length ?? 0) +
    (req.schema ? JSON.stringify(req.schema).length : 0)
  let imagenes = 0
  for (const m of req.messages) {
    if (typeof m.content === 'string') {
      caracteres += m.content.length
      continue
    }
    for (const b of m.content) {
      if (b.type === 'text') caracteres += b.text.length
      else if (b.type === 'image') imagenes++
    }
  }
  return (
    Math.ceil(caracteres / CARACTERES_POR_TOKEN) + imagenes * TOKENS_POR_IMAGEN
  )
}

/**
 * Uso facturado de un mensaje. Con fallbacks del lado del servidor, el usage
 * de nivel superior solo cubre el intento que respondió; los intentos
 * anteriores (de otros modelos) vienen en usage.iterations.
 */
function usoDelMensaje(
  message: Anthropic.Beta.Messages.BetaMessage,
  model: string
): UsoLlamada {
  const u = message.usage
  const modelo = message.model || model
  const entradaArriba =
    u.input_tokens +
    (u.cache_creation_input_tokens ?? 0) +
    (u.cache_read_input_tokens ?? 0)
  const arriba: UsoLlamada = {
    inputTokens: entradaArriba,
    outputTokens: u.output_tokens,
    costoUsd: estimateCost(modelo, entradaArriba, u.output_tokens),
  }
  const iteraciones = u.iterations ?? []
  if (iteraciones.length === 0) return arriba

  const suma = usoVacio()
  for (const it of iteraciones) {
    const entrada =
      it.input_tokens +
      it.cache_creation_input_tokens +
      it.cache_read_input_tokens
    const modeloIt = ('model' in it && it.model) || modelo
    suma.inputTokens += entrada
    suma.outputTokens += it.output_tokens
    suma.costoUsd += estimateCost(modeloIt, entrada, it.output_tokens)
  }
  // Por si la lista de iteraciones viniera incompleta: nunca menos que arriba.
  return suma.costoUsd >= arriba.costoUsd ? suma : arriba
}

/**
 * Uso estimado de un stream que falló antes de terminar (abortado por el
 * cliente, timeout, error a mitad...). Con message_start ya recibido, la
 * entrada es la real y la salida se acota por el tiempo transcurrido (nunca
 * más de maxTokens). Sin él, se estima la entrada salvo que el fallo
 * demuestre que la API no llegó a procesar la petición.
 */
function usoDeStreamCortado(
  err: unknown,
  snapshot: Anthropic.Beta.Messages.BetaMessage | undefined,
  inicioSalida: number | null,
  req: AiRequest,
  model: string
): UsoLlamada {
  if (snapshot) {
    const uso = usoDelMensaje(snapshot, model)
    const modelo = snapshot.model || model
    const segundos =
      inicioSalida === null ? 0 : (Date.now() - inicioSalida) / 1000
    const salida = Math.min(
      req.maxTokens,
      Math.max(
        uso.outputTokens,
        Math.ceil(segundos * tokensSalidaPorSegundo(modelo))
      )
    )
    if (salida <= uso.outputTokens) return uso
    // La salida extra, con la tarifa que corresponda al tamaño del prompt.
    const extra =
      estimateCost(modelo, uso.inputTokens, salida) -
      estimateCost(modelo, uso.inputTokens, uso.outputTokens)
    return {
      inputTokens: uso.inputTokens,
      outputTokens: salida,
      costoUsd: uso.costoUsd + Math.max(0, extra),
    }
  }
  // Respuesta HTTP de error (400, 429, 5xx…) o fallo de conexión: la API no
  // procesó la petición y no cobra. Un aborto o un timeout, en cambio, pueden
  // llegar cuando la API ya estaba leyendo el prompt.
  const sinCobro =
    (err instanceof Anthropic.APIError && typeof err.status === 'number') ||
    (err instanceof Anthropic.APIConnectionError &&
      !(err instanceof Anthropic.APIConnectionTimeoutError))
  if (sinCobro) return usoVacio()
  const entrada = estimarTokensEntrada(req)
  return {
    inputTokens: entrada,
    outputTokens: 0,
    costoUsd: estimateCost(model, entrada, 0),
  }
}

async function callAnthropic(
  req: AiRequest,
  model: string,
  parcial: UsoLlamada
): Promise<Omit<AiResult, 'latencyMs'> & { costoUsd: number }> {
  // Ya abortada: no se envía nada (y no hay nada que cobrar).
  if (req.signal?.aborted) throw new Anthropic.APIUserAbortError()

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
  // Desde message_start el modelo ya genera (pensamiento incluido).
  let inicioSalida: number | null = null
  stream.on('streamEvent', (ev) => {
    if (ev.type === 'message_start' && inicioSalida === null) {
      inicioSalida = Date.now()
    }
  })

  let message: Anthropic.Beta.Messages.BetaMessage
  try {
    message = await stream.finalMessage()
  } catch (err) {
    // El snapshot sobrevive al error: trae input_tokens desde message_start.
    Object.assign(
      parcial,
      usoDeStreamCortado(err, stream.currentMessage, inicioSalida, req, model)
    )
    throw err
  }

  const uso = usoDelMensaje(message, model)
  const stopReason = mapAnthropicStop(message.stop_reason)
  // Un rechazo (también a mitad del stream) se factura a tarifa normal.
  if (stopReason === 'refusal') {
    Object.assign(parcial, uso)
    throw new AiRefusalError()
  }

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
    inputTokens: uso.inputTokens,
    outputTokens: uso.outputTokens,
    costoUsd: uso.costoUsd,
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

/**
 * Registra el uso tras responder (after) o en segundo plano fuera de una
 * petición. `alEscribir` se llama solo si la fila llegó de verdad a ai_logs;
 * si el insert falló, el gasto sigue contando en local (ver presupuesto.ts).
 */
function logLater(
  entry: Parameters<typeof logAiUsage>[0],
  alEscribir?: () => void
): void {
  const tarea = async (): Promise<void> => {
    if (await logAiUsage(entry)) alEscribir?.()
  }
  try {
    after(tarea)
  } catch {
    void tarea()
  }
}

export async function aiGenerate(req: AiRequest): Promise<AiResult> {
  // Corte duro del tope diario: freno ante generaciones largas o concurrentes
  // que ya pasaron la comprobación de su ruta. Sin tope no consulta nada.
  if (await corteDuroAlcanzado()) throw new AiTopeDiarioError()

  const provider = aiProvider()
  const model = req.model ?? aiModel(req.task)
  const start = Date.now()
  // Lo ya gastado si la llamada falla (aborto, timeout, rechazo, corte).
  const parcial = usoVacio()
  try {
    const r: Omit<AiResult, 'latencyMs'> & { costoUsd?: number } =
      provider === 'groq'
        ? await callGroq(req, model)
        : await callAnthropic(req, model, parcial)
    const latencyMs = Date.now() - start
    const costoUsd =
      r.costoUsd ?? estimateCost(r.model, r.inputTokens, r.outputTokens)
    // El coste cuenta para el tope de esta instancia desde ya, sin esperar a
    // que after() escriba la fila en ai_logs.
    const yaRegistrado = registrarGastoLocal(costoUsd)
    logLater(
      {
        provider,
        model: r.model,
        endpoint: req.endpoint ?? req.task,
        userId: req.userId ?? null,
        promptTokens: r.inputTokens,
        completionTokens: r.outputTokens,
        costUsd: costoUsd,
        latencyMs,
        success: r.stopReason !== 'max_tokens',
        ...(r.stopReason === 'max_tokens' ? { error: 'max_tokens' } : {}),
      },
      yaRegistrado
    )
    return {
      text: r.text,
      stopReason: r.stopReason,
      provider: r.provider,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      latencyMs,
    }
  } catch (err) {
    // Abortos, timeouts y rechazos también se facturan: cuentan para el tope
    // (estimación prudente, ver usoDeStreamCortado).
    const yaRegistrado = registrarGastoLocal(parcial.costoUsd)
    logLater(
      {
        provider,
        model,
        endpoint: req.endpoint ?? req.task,
        userId: req.userId ?? null,
        promptTokens: parcial.inputTokens,
        completionTokens: parcial.outputTokens,
        costUsd: parcial.costoUsd,
        latencyMs: Date.now() - start,
        success: false,
        error: err instanceof Error ? err.message.slice(0, 500) : 'unknown',
      },
      yaRegistrado
    )
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
  | 'tope_diario'
  | 'unknown'

/**
 * Clasifica un error de IA para decidir el mensaje al usuario. El detalle
 * técnico va a Sentry/logs; al usuario solo se le muestra `mensaje`.
 */
export function describeAiError(err: unknown): {
  code: AiErrorCode
  mensaje: string
} {
  if (err instanceof AiTopeDiarioError) {
    return { code: 'tope_diario', mensaje: MENSAJE_TOPE_DIARIO }
  }
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
