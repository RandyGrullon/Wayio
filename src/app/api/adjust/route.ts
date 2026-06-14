import * as Sentry from '@sentry/nextjs'
import { aiClient } from '@/lib/ai/client'
import { extractJson } from '@/lib/ai/extractJson'
import { aiConfigured } from '@/lib/ai/config'
import { buildViatorLink } from '@/constants/affiliateLinks'
import type { Trip, Day } from '@/types/trip'
import type { Activity, ActivityType } from '@/types/activity'

export const maxDuration = 60

interface AdjustBody {
  trip?: Trip
  instruccion?: string
}

const TIPOS_VALIDOS: ActivityType[] = [
  'museo',
  'restaurante',
  'templo',
  'parque',
  'barrio',
  'playa',
  'actividad',
  'traslado',
]

type PartialTrip = Pick<
  Trip,
  | 'destino'
  | 'resumenViaje'
  | 'presupuestoTotal'
  | 'presupuestoPorPersona'
  | 'dias'
  | 'advertencias'
  | 'consejos'
>

function buildAdjustPrompt(trip: Trip, instruccion: string): string {
  // Mandamos solo lo esencial del trip para ahorrar tokens.
  const compacto: PartialTrip = {
    destino: trip.destino,
    resumenViaje: trip.resumenViaje,
    presupuestoTotal: trip.presupuestoTotal,
    presupuestoPorPersona: trip.presupuestoPorPersona,
    dias: trip.dias,
    advertencias: trip.advertencias,
    consejos: trip.consejos,
  }

  return `
Eres el mejor planificador de viajes del mundo. Te paso un itinerario YA generado
y una instrucción del usuario para AJUSTARLO. Devuelve el itinerario completo
modificado.

REGLAS:
- Aplica SOLO lo que pide la instrucción; conserva lo demás igual.
- MANTÉN el campo "id" de cada actividad que no cambie (no inventes ids nuevos
  para actividades existentes). Las actividades NUEVAS pueden llevar id vacío.
- Conserva "lat" y "lng" de las actividades que no muevas de lugar.
- Reajusta los presupuestos (presupuestoDia, presupuestoTotal,
  presupuestoPorPersona, precioEstimado) para que sean coherentes con los cambios.
- Mantén las horas realistas y sin solapamientos.
- "tipo" debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.

INSTRUCCIÓN DEL USUARIO:
"${instruccion}"

ITINERARIO ACTUAL (JSON):
${JSON.stringify(compacto)}

RESPONDE SOLO CON UN JSON VÁLIDO con esta estructura (sin texto, sin fences):
{
  "destino": string,
  "resumenViaje": string,
  "presupuestoTotal": number,
  "presupuestoPorPersona": number,
  "dias": [
    {
      "numero": number,
      "titulo": string,
      "descripcion": string,
      "ciudad": string,
      "presupuestoDia": number,
      "colorMapa": string,
      "actividades": [
        {
          "id": string,
          "nombre": string,
          "descripcion": string,
          "horaInicio": "HH:MM",
          "horaFin": "HH:MM",
          "duracionMinutos": number,
          "tipo": "museo|restaurante|templo|parque|barrio|playa|actividad|traslado",
          "direccion": string,
          "lat": number,
          "lng": number,
          "radioGeofencingMetros": number,
          "precioEstimado": number,
          "reservaRequerida": boolean,
          "mejorHoraVisita": string,
          "consejos": [string],
          "tiempoHastaSiguiente": number
        }
      ]
    }
  ],
  "advertencias": [string],
  "consejos": [string]
}
`
}

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : fallback

/** Rellena los campos obligatorios que el modelo pueda haber omitido. */
function normalizeActivity(raw: Partial<Activity>, ciudad: string): Activity {
  const tipo = TIPOS_VALIDOS.includes(raw.tipo as ActivityType)
    ? (raw.tipo as ActivityType)
    : 'actividad'
  const nombre = str(raw.nombre, 'Actividad')
  const id = str(raw.id).trim() || crypto.randomUUID()

  const base: Activity = {
    id,
    nombre,
    descripcion: str(raw.descripcion),
    horaInicio: str(raw.horaInicio, '09:00'),
    horaFin: str(raw.horaFin, '10:00'),
    duracionMinutos: num(raw.duracionMinutos, 60),
    tipo,
    direccion: str(raw.direccion),
    lat: num(raw.lat),
    lng: num(raw.lng),
    radioGeofencingMetros: num(raw.radioGeofencingMetros, 150),
    precioEstimado: num(raw.precioEstimado),
    reservaRequerida: Boolean(raw.reservaRequerida),
    reservaPagada: false,
    mejorHoraVisita: str(raw.mejorHoraVisita),
    consejos: Array.isArray(raw.consejos)
      ? raw.consejos.filter((c): c is string => typeof c === 'string')
      : [],
    tiempoHastaSiguiente: num(raw.tiempoHastaSiguiente),
    estado: 'pendiente',
    esPerdida: false,
  }

  // Solo adjuntamos enlace de afiliado a lugares de pago (no a traslados).
  return tipo !== 'traslado'
    ? { ...base, linkAfiliado: buildViatorLink(nombre, ciudad) }
    : base
}

function normalizeDay(raw: Partial<Day>, idx: number): Day {
  const ciudad = str(raw.ciudad)
  const actividadesRaw = Array.isArray(raw.actividades) ? raw.actividades : []
  return {
    numero: num(raw.numero, idx + 1),
    titulo: str(raw.titulo, `Día ${idx + 1}`),
    descripcion: str(raw.descripcion),
    ciudad,
    presupuestoDia: num(raw.presupuestoDia),
    colorMapa: str(raw.colorMapa, '#2E75B6'),
    actividades: actividadesRaw.map((a) =>
      normalizeActivity(a as Partial<Activity>, ciudad)
    ),
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!aiConfigured()) {
    return Response.json(
      {
        error:
          'El ajuste con IA necesita una API key de IA configurada (ANTHROPIC_API_KEY o GROQ_API_KEY).',
      },
      { status: 503 }
    )
  }

  let body: AdjustBody
  try {
    body = (await request.json()) as AdjustBody
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { trip, instruccion } = body
  if (!trip || !Array.isArray(trip.dias) || !instruccion?.trim()) {
    return Response.json(
      { error: 'Faltan "trip" o "instruccion".' },
      { status: 400 }
    )
  }

  try {
    const message = await aiClient.messages.create({
      model: process.env.AI_ITINERARY_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: Number(process.env.AI_ITINERARY_MAX_TOKENS) || 4096,
      messages: [
        { role: 'user', content: buildAdjustPrompt(trip, instruccion.trim()) },
      ],
    })

    const text =
      (
        message.content.find((b) => b.type === 'text') as
          | { type: 'text'; text: string }
          | undefined
      )?.text ?? ''

    const partial = extractJson<Partial<PartialTrip>>(text)
    if (!Array.isArray(partial.dias) || partial.dias.length === 0) {
      throw new Error('La IA no devolvió días válidos')
    }

    const dias = partial.dias.map((d, i) => normalizeDay(d as Partial<Day>, i))

    // Conservamos los metadatos del viaje original; la IA solo ajusta contenido.
    const updated: Trip = {
      ...trip,
      destino: str(partial.destino, trip.destino),
      resumenViaje: str(partial.resumenViaje, trip.resumenViaje),
      presupuestoTotal: num(partial.presupuestoTotal, trip.presupuestoTotal),
      presupuestoPorPersona: num(
        partial.presupuestoPorPersona,
        trip.presupuestoPorPersona
      ),
      dias,
      advertencias: Array.isArray(partial.advertencias)
        ? partial.advertencias.filter((a): a is string => typeof a === 'string')
        : trip.advertencias,
      consejos: Array.isArray(partial.consejos)
        ? partial.consejos.filter((c): c is string => typeof c === 'string')
        : trip.consejos,
    }

    return Response.json({ trip: updated })
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'adjust-itinerary' } })
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    const amable = /429|rate.?limit|tokens per day|TPD/i.test(msg)
      ? 'Se alcanzó el límite de tokens del proveedor de IA. Intenta de nuevo en un momento.'
      : 'No se pudo ajustar el itinerario. Intenta reformular tu instrucción.'
    return Response.json({ error: amable }, { status: 502 })
  }
}
