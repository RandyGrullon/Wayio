import type { Activity } from '../../types/activity'
import type { AlertMessage } from '../../types/alert'

const API_BASE = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'

export function buildAlertPrompt(
  actividad: Activity,
  itinerarioRestante: Activity[],
  retrasoMinutos: number
): string {
  return `
Eres un amigo que conoce muy bien el destino y ayuda al viajero.
Hablas de forma natural, calida y directa. Nunca robotica.

El viajero lleva ${retrasoMinutos} minutos de retraso.
Actividad actual: ${actividad.nombre}
Lo que queda del dia: ${JSON.stringify(itinerarioRestante)}

Analiza la situacion y responde en JSON con:
{
  mensajeAmigable: string,
  actividadRecomendarQuitar: string | null,
  razonSimple: string,
  tiempoQueAhorra: number,
  alternativa: string | null
}

REGLAS CRITICAS:
- NUNCA recomendar quitar algo ya pagado o con reserva confirmada.
- NUNCA recomendar quitar algo que el usuario voto positivo en el grupo.
- Priorizar actividades unicas e irrepetibles sobre las que se pueden ver en otra ciudad.
- Si el retraso es recuperable sin quitar nada, decirlo.
`.trim()
}

export async function generateAlertMessage(
  actividad: Activity,
  itinerarioRestante: Activity[],
  retrasoMinutos: number
): Promise<AlertMessage> {
  const prompt = buildAlertPrompt(actividad, itinerarioRestante, retrasoMinutos)

  const response = await fetch(`${API_BASE}/api/alert-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })

  if (!response.ok) {
    throw new Error(`alert-message API error: ${response.status}`)
  }

  return response.json() as Promise<AlertMessage>
}
