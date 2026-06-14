import { createAdminClientSafe } from '@/lib/supabase/admin'
import { estimateCost } from './pricing'

export interface AiUsageEntry {
  provider: string
  model: string
  endpoint?: string
  promptTokens: number
  completionTokens: number
  latencyMs: number
  success: boolean
  error?: string
}

/**
 * Registra el uso de IA en ai_logs (best-effort, fire-and-forget). Si falta la
 * service role key simplemente no hace nada — nunca rompe la generación.
 */
export async function logAiUsage(e: AiUsageEntry): Promise<void> {
  const client = createAdminClientSafe()
  if (!client) return
  try {
    await client.from('ai_logs').insert({
      provider: e.provider,
      model: e.model,
      endpoint: e.endpoint ?? null,
      prompt_tokens: e.promptTokens,
      completion_tokens: e.completionTokens,
      total_tokens: e.promptTokens + e.completionTokens,
      cost_usd: estimateCost(e.model, e.promptTokens, e.completionTokens),
      latency_ms: e.latencyMs,
      success: e.success,
      error: e.error ?? null,
    })
  } catch {
    // logging es best-effort
  }
}
