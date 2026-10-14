/**
 * Configuración central de la IA: proveedor, modelos y esfuerzo por tarea.
 *
 * Todos los ids de modelo viven aquí (antes estaban repartidos por varios
 * archivos). Cada uno se puede sobrescribir con variables de entorno.
 */

export type AiProvider = 'anthropic' | 'groq'

/**
 * Tareas de IA de la app. Cada una tiene modelo y esfuerzo propios:
 * - itinerario: generar el viaje completo (la más exigente).
 * - ajuste: modificar un itinerario existente por chat.
 * - interpretar: convertir una descripción libre en campos del formulario.
 * - rapido: mensajes cortos (alertas, reagendado, validación de horarios).
 * - vision: analizar fotogramas de un video.
 */
export type AiTask =
  | 'itinerario'
  | 'ajuste'
  | 'interpretar'
  | 'rapido'
  | 'vision'

export type AiEffort = 'low' | 'medium' | 'high'

export function aiProvider(): AiProvider {
  const raw = (process.env.AI_PROVIDER ?? 'anthropic').trim().toLowerCase()
  return raw === 'groq' ? 'groq' : 'anthropic'
}

/** ¿Hay un proveedor de IA con su API key configurada? */
export function aiConfigured(): boolean {
  return aiProvider() === 'groq'
    ? Boolean(process.env.GROQ_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY)
}

const env = (name: string): string | undefined => {
  const v = process.env[name]?.trim()
  return v ? v : undefined
}

/** Modelo principal (itinerario y ajustes). */
const ANTHROPIC_MAIN = 'claude-opus-5-5'
/** Modelo rápido para tareas cortas y de extracción. */
const ANTHROPIC_FAST = 'claude-haiku-5-5'

/** Modelos vigentes de Groq (los llama-3.x/4-scout fueron dados de baja). */
const GROQ_TEXT = 'openai/gpt-oss-120b'
const GROQ_VISION = 'qwen/qwen3.8-27b'

export function aiModel(task: AiTask): string {
  if (aiProvider() === 'groq') {
    return task === 'vision'
      ? (env('GROQ_VISION_MODEL') ?? GROQ_VISION)
      : (env('GROQ_MODEL') ?? GROQ_TEXT)
  }
  switch (task) {
    case 'itinerario':
    case 'ajuste':
      return env('AI_ITINERARY_MODEL') ?? ANTHROPIC_MAIN
    case 'vision':
      return (
        env('AI_VISION_MODEL') ?? env('AI_ITINERARY_MODEL') ?? ANTHROPIC_MAIN
      )
    case 'interpretar':
    case 'rapido':
      return env('AI_FAST_MODEL') ?? ANTHROPIC_FAST
  }
}

/**
 * Esfuerzo de razonamiento por tarea (output_config.effort en Anthropic).
 * En los modelos actuales el razonamiento siempre está activo; el esfuerzo es
 * la palanca de calidad/latencia/coste.
 */
export function aiEffort(task: AiTask): AiEffort {
  const override = env(
    task === 'itinerario' ? 'AI_ITINERARY_EFFORT' : 'AI_EFFORT'
  )
  if (override === 'low' || override === 'medium' || override === 'high') {
    return override
  }
  switch (task) {
    case 'itinerario':
    case 'ajuste':
      return 'medium'
    case 'vision':
      return 'medium'
    case 'interpretar':
    case 'rapido':
      return 'low'
  }
}

/**
 * Versión del prompt de generación. Forma parte de la clave de caché: al
 * cambiar el prompt, los resultados cacheados con la versión anterior dejan de
 * servirse.
 */
export const PROMPT_VERSION = 'v3-2026-10'
