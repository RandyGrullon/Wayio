import * as Sentry from '@sentry/nextjs'

/**
 * Precios por 1M de tokens (USD) para estimar el coste de cada llamada en el
 * panel de IA y en el tope diario (ai_logs.cost_usd). Ajusta si cambian las
 * tarifas. Los de Groq son una estimación de su tarifa de pago.
 *
 * Un modelo sin precio NO se registra a 0 (eso apagaría el tope diario en
 * silencio justo con el modelo más caro): se estima por familia con el precio
 * más alto conocido y se avisa una vez por modelo para añadir el real aquí.
 */
export interface Tarifa {
  input: number
  output: number
}

interface ModelPrice extends Tarifa {
  /**
   * Tarifa de contexto largo: cuando el prompt pasa de `desde` tokens, TODA la
   * llamada (entrada y salida) se cobra con esta tarifa.
   */
  largo?: Tarifa & { desde: number }
}

const PRICES: Record<string, ModelPrice> = {
  // Anthropic (tabla de precios de la API de Anthropic, consultada el
  // 2026-10-17 con la referencia de modelos cacheada el 2026-10-06).
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  // Haiku 5.5: $0,10/$0,50 con prompts de hasta 100K tokens y $0,50/$2,50
  // por encima (misma referencia).
  'claude-haiku-5-5': {
    input: 0.1,
    output: 0.5,
    largo: { desde: 100_000, input: 0.5, output: 2.5 },
  },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  // Destinos del fallback del lado del servidor (fallbacks: 'default' en
  // client.ts): si responden ellos, message.model trae su id.
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-fable-5-1': { input: 10, output: 50 },
  // Otros modelos vigentes que se pueden elegir por variable de entorno
  // (AI_ITINERARY_MODEL, AI_VISION_MODEL, AI_FAST_MODEL; misma referencia).
  'claude-fable-5': { input: 10, output: 50 },
  'claude-mythos-5-1': { input: 10, output: 50 },
  'claude-mythos-5': { input: 10, output: 50 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  // Groq (el plan gratis cuesta 0; estimamos su tarifa de pago)
  'openai/gpt-oss-120b': { input: 0.15, output: 0.6 },
  'openai/gpt-oss-20b': { input: 0.075, output: 0.3 },
  'qwen/qwen3.8-27b': { input: 0.2, output: 0.6 },
}

/**
 * Precio prudente de un modelo Claude sin precio, por familia: el MÁS ALTO
 * conocido de cada una (Opus 4.1 y anteriores costaban $15/$75; Sonnet nunca
 * pasó de $3/$15; Haiku 4.5 es el Haiku más caro, $1/$5). Sobrestimar solo
 * adelanta el tope; un 0 lo desactiva.
 */
const FAMILIAS_CLAUDE: { patron: RegExp; precio: Tarifa }[] = [
  { patron: /fable|mythos/, precio: { input: 10, output: 50 } },
  { patron: /opus/, precio: { input: 15, output: 75 } },
  { patron: /sonnet/, precio: { input: 3, output: 15 } },
  { patron: /haiku/, precio: { input: 1, output: 5 } },
]
/** Claude de familia desconocida: el precio más alto de la tabla de familias. */
const CLAUDE_DESCONOCIDO: Tarifa = { input: 15, output: 75 }
/**
 * Otro proveedor (GROQ_MODEL / GROQ_VISION_MODEL con un id fuera de la tabla):
 * cota alta de las tarifas de pago de Groq para modelos abiertos grandes.
 */
const OTRO_DESCONOCIDO: Tarifa = { input: 1, output: 3 }

/** Modelos sin precio ya avisados en esta instancia (uno por modelo). */
const avisados = new Set<string>()
const AVISADOS_MAX = 100

function avisarSinPrecio(model: string, estimado: Tarifa): void {
  if (avisados.has(model) || avisados.size >= AVISADOS_MAX) return
  avisados.add(model)
  // eslint-disable-next-line no-console
  console.warn(
    `[wayio] ai-presupuesto: el modelo «${model}» no tiene precio en pricing.ts; se estima a $${estimado.input}/$${estimado.output} por millón. Añade su precio real.`
  )
  Sentry.captureMessage('Modelo de IA sin precio en pricing.ts', {
    level: 'warning',
    tags: { area: 'ai-presupuesto' },
    extra: { model, estimado },
  })
}

/** Precio del modelo, tolerando sufijos de fecha (claude-x-20260101). */
function priceFor(model: string): ModelPrice {
  const exacto = PRICES[model]
  if (exacto) return exacto
  const sinFecha = PRICES[model.replace(/-\d{8}$/, '')]
  if (sinFecha) return sinFecha

  const id = model.toLowerCase()
  const estimado = id.includes('claude')
    ? (FAMILIAS_CLAUDE.find((f) => f.patron.test(id))?.precio ??
      CLAUDE_DESCONOCIDO)
    : OTRO_DESCONOCIDO
  avisarSinPrecio(model, estimado)
  return estimado
}

/**
 * Tarifa (US$ por millón de tokens, contexto normal) de un modelo de la tabla,
 * o null si no está. Sin estimaciones ni avisos: la usa la calculadora de
 * rentabilidad del panel para rotular sus escenarios por modelo (el costo de
 * cada escenario se recalcula con estimateCost desde los tokens).
 */
export function tarifaModelo(model: string): Tarifa | null {
  const p = PRICES[model] ?? PRICES[model.replace(/-\d{8}$/, '')]
  return p ? { input: p.input, output: p.output } : null
}

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  if (!(promptTokens > 0) && !(completionTokens > 0)) return 0
  const p = priceFor(model)
  const t = p.largo && promptTokens > p.largo.desde ? p.largo : p
  return (
    (Math.max(0, promptTokens) / 1_000_000) * t.input +
    (Math.max(0, completionTokens) / 1_000_000) * t.output
  )
}
