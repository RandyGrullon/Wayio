/**
 * Extrae y parsea el primer objeto/array JSON de una respuesta de IA.
 *
 * Los modelos (sobre todo los de Groq/Llama) a veces envuelven el JSON en
 * bloques ```json ... ```, añaden texto antes/después, o ponen comas finales.
 * Esta función limpia todo eso y devuelve el objeto parseado, o lanza un error
 * claro si no hay JSON recuperable.
 */
export function extractJson<T = unknown>(raw: string): T {
  if (!raw || !raw.trim()) {
    throw new Error('Respuesta de IA vacía')
  }

  let text = raw.trim()

  // Quitar fences de código (```json ... ``` o ``` ... ```)
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) text = fence[1].trim()

  // Intentar parsear directo
  try {
    return JSON.parse(text) as T
  } catch {
    // continuar con extracción por delimitadores
  }

  // Tomar desde el primer { o [ hasta su cierre correspondiente
  const start = text.search(/[{[]/)
  if (start === -1) {
    throw new Error('No se encontró JSON en la respuesta de IA')
  }
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  const end = text.lastIndexOf(close)
  if (end <= start) {
    throw new Error('JSON incompleto en la respuesta de IA')
  }

  let candidate = text.slice(start, end + 1)

  try {
    return JSON.parse(candidate) as T
  } catch {
    // Reparaciones comunes de modelos pequeños:
    candidate = candidate
      // comas finales antes de } o ]
      .replace(/,\s*([}\]])/g, '$1')
      // escapes \u inválidos (no seguidos de 4 dígitos hex) → quitar backslash
      .replace(/\\u(?![0-9a-fA-F]{4})/g, 'u')
      // otros escapes inválidos (\ seguido de algo que no es escape válido)
      .replace(/\\(?!["\\/bfnrtu])/g, '')
    return JSON.parse(candidate) as T
  }
}
