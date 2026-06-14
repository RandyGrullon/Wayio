/** ¿Hay un proveedor de IA con su API key configurada? */
export function aiConfigured(): boolean {
  const provider = (process.env.AI_PROVIDER ?? 'anthropic').toLowerCase()
  return provider === 'groq'
    ? Boolean(process.env.GROQ_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY)
}
