/**
 * Precios aproximados por 1M de tokens (USD). Sirven para estimar el costo
 * de cada llamada en el panel de IA. Ajusta si cambian las tarifas.
 */
interface ModelPrice {
  input: number
  output: number
}

const PRICES: Record<string, ModelPrice> = {
  // Anthropic (producción)
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
  // Groq (pruebas, gratis pero estimamos por si migran a su tier de pago)
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'meta-llama/llama-4-scout-17b-16e-instruct': { input: 0.11, output: 0.34 },
}

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const p = PRICES[model] ?? { input: 0, output: 0 }
  return (
    (promptTokens / 1_000_000) * p.input +
    (completionTokens / 1_000_000) * p.output
  )
}
