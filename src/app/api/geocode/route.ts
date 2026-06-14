import { geocode } from '@/lib/api/geocode'

export const maxDuration = 60

/**
 * Geocodificación en lote para el cliente. La pantalla de resultado llama aquí
 * tras mostrar el itinerario para rellenar las coordenadas de las actividades
 * que la IA no ancló (más allá de las ~6 que geocodifica /api/generate inline).
 *
 * Nominatim limita a ~1 req/s, así que las resolvemos en serie con una pausa.
 * Por eso esto vive en el servidor (no en el navegador): respeta el rate-limit,
 * manda el User-Agent que pide su política de uso y evita CORS.
 */

interface GeocodeItem {
  nombre: string
  ciudad: string
}

// Cota superior para no acercarnos a maxDuration (25 × 1.1s ≈ 28s).
const MAX_ITEMS = 25
const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms))

function asItem(value: unknown): GeocodeItem {
  const obj = (value ?? {}) as Partial<GeocodeItem>
  return {
    nombre: typeof obj.nombre === 'string' ? obj.nombre : '',
    ciudad: typeof obj.ciudad === 'string' ? obj.ciudad : '',
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const rawItems = (body as { items?: unknown })?.items
  if (!Array.isArray(rawItems)) {
    return Response.json({ error: 'Falta "items"' }, { status: 400 })
  }

  const items = rawItems.slice(0, MAX_ITEMS).map(asItem)
  const results: ({ lat: number; lng: number } | null)[] = []

  for (const [i, { nombre, ciudad }] of items.entries()) {
    if (!nombre.trim()) {
      results.push(null)
      continue
    }
    const punto = await geocode(ciudad ? `${nombre}, ${ciudad}` : nombre)
    results.push(punto ? { lat: punto.lat, lng: punto.lng } : null)
    // Pausa entre llamadas (no tras la última) para respetar el rate-limit.
    if (i < items.length - 1) await sleep(1100)
  }

  return Response.json({ results })
}
