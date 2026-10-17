import { createAdminClientSafe } from '@/lib/supabase/admin'
import { estimateCost } from './pricing'

export interface AiUsageEntry {
  provider: string
  model: string
  endpoint?: string
  userId?: string | null
  promptTokens: number
  completionTokens: number
  /**
   * Coste ya calculado (p. ej. una llamada con fallback que sumó varios
   * modelos). Si falta, se estima con `model` y los tokens.
   */
  costUsd?: number
  latencyMs: number
  success: boolean
  error?: string
}

/**
 * Registra el uso de IA en ai_logs (best-effort): nunca rompe la generación.
 * Devuelve true solo si la fila llegó a la BD (supabase-js no lanza: devuelve
 * `{ error }`), para que el tope diario no dé por escrito un coste que falló.
 * Sin service role key no hace nada y devuelve false.
 */
export async function logAiUsage(e: AiUsageEntry): Promise<boolean> {
  const client = createAdminClientSafe()
  if (!client) return false
  try {
    const { error } = await client.from('ai_logs').insert({
      provider: e.provider,
      model: e.model,
      endpoint: e.endpoint ?? null,
      user_id: e.userId ?? null,
      prompt_tokens: e.promptTokens,
      completion_tokens: e.completionTokens,
      total_tokens: e.promptTokens + e.completionTokens,
      cost_usd:
        e.costUsd ?? estimateCost(e.model, e.promptTokens, e.completionTokens),
      latency_ms: e.latencyMs,
      success: e.success,
      error: e.error ?? null,
    })
    return !error
  } catch {
    // logging es best-effort
    return false
  }
}
