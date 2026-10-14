/**
 * Precios por 1M de tokens (USD) para estimar el coste de cada llamada en el
 * panel de IA. Ajusta si cambian las tarifas. Los modelos sin precio se
 * registran con coste 0. Los de Groq son una estimación de su tarifa de pago.
 */
interface ModelPrice {
  input: number
  output: number
}

const PRICES: Record<string, ModelPrice> = {
  // Anthropic
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  // Groq (el plan gratis cuesta 0; estimamos su tarifa de pago)
  'openai/gpt-oss-120b': { input: 0.15, output: 0.6 },
  'openai/gpt-oss-20b': { input: 0.075, output: 0.3 },
  'qwen/qwen3.8-27b': { input: 0.2, output: 0.6 },
}

/** Precio del modelo, tolerando sufijos de fecha (claude-x-20260101). */
function priceFor(model: string): ModelPrice | undefined {
  if (PRICES[model]) return PRICES[model]
  const sinFecha = model.replace(/-\d{8}$/, '')
  return PRICES[sinFecha]
}

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const p = priceFor(model)
  if (!p) return 0
  return (
    (promptTokens / 1_000_000) * p.input +
    (completionTokens / 1_000_000) * p.output
  )
}
