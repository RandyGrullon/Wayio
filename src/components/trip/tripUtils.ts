import type { Day, Trip } from '@/types/trip'
import type { Activity, ActivityType } from '@/types/activity'
import { parseFecha } from '@/lib/utils/formatters'

/**
 * Utilidades puras del itinerario (resultado, viaje guardado y compartido).
 * Sin React: se pueden usar en el servidor y en el cliente.
 */

export type MonedaViaje = 'USD' | 'EUR' | 'DOP'

const MONEDAS: readonly MonedaViaje[] = ['USD', 'EUR', 'DOP']

function esMoneda(v: unknown): v is MonedaViaje {
  return typeof v === 'string' && (MONEDAS as readonly string[]).includes(v)
}

/** Moneda del viaje; si falta, la del formulario; si falta, USD. */
export function monedaDelViaje(
  trip: { moneda?: unknown } | null | undefined,
  form?: { moneda?: unknown } | null
): MonedaViaje {
  if (esMoneda(trip?.moneda)) return trip.moneda
  if (esMoneda(form?.moneda)) return form.moneda
  return 'USD'
}

/** Etiquetas en español de los tipos de actividad. */
export const TIPO_LABEL: Record<ActivityType, string> = {
  museo: 'Museo',
  restaurante: 'Comida',
  templo: 'Templo',
  parque: 'Parque',
  barrio: 'Barrio',
  playa: 'Playa',
  actividad: 'Actividad',
  traslado: 'Traslado',
}

export const TIPOS_ACTIVIDAD: readonly ActivityType[] = [
  'actividad',
  'museo',
  'restaurante',
  'templo',
  'parque',
  'barrio',
  'playa',
  'traslado',
]

export const PAQUETE_LABEL: Record<Trip['paquete'], string> = {
  basico: 'Básico',
  confort: 'Confort',
  premium: 'Premium',
}

/** ¿Tiene coordenadas utilizables? (0,0 = sin ubicar). */
export function tieneCoords(a: Pick<Activity, 'lat' | 'lng'>): boolean {
  return (
    Number.isFinite(a.lat) &&
    Number.isFinite(a.lng) &&
    !(a.lat === 0 && a.lng === 0)
  )
}

/** «Check-in en <hotel>»: el alojamiento ya viene en el plan. */
export function esCheckIn(a: Pick<Activity, 'nombre'>): boolean {
  return /\bcheck-?in\b/i.test(a.nombre)
}

/** Número de actividades del viaje (sin contar los traslados). */
export function contarActividades(trip: Pick<Trip, 'dias'>): number {
  return trip.dias.reduce(
    (n, d) => n + d.actividades.filter((a) => a.tipo !== 'traslado').length,
    0
  )
}

/** Coordenadas representativas del destino (la primera verificada). */
export function coordenadasDelViaje(
  trip: Pick<Trip, 'dias'>
): { lat: number; lng: number } | null {
  const todas = trip.dias.flatMap((d) => d.actividades)
  const elegida =
    todas.find((a) => a.coordsVerificadas && tieneCoords(a)) ??
    todas.find(tieneCoords)
  return elegida ? { lat: elegida.lat, lng: elegida.lng } : null
}

/** Fecha del día `indice` (0 = primer día) del viaje. */
export function fechaDelDia(
  trip: Pick<Trip, 'fechaInicio'>,
  indice: number
): Date | null {
  const base = parseFecha(trip.fechaInicio)
  if (!base) return null
  const f = new Date(base)
  f.setDate(f.getDate() + indice)
  return f
}

/** Ciudad del día o, si falta, el destino del viaje. */
export function ciudadDelDia(dia: Day, trip: Pick<Trip, 'destino'>): string {
  return dia.ciudad?.trim() || trip.destino
}

/** "HH:MM" → minutos desde la medianoche; null si no es válida. */
export function minutosDeHora(hora: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((hora ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Minutos → "HH:MM" (acotado al día). */
export function horaDeMinutos(minutos: number): string {
  const t = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutos)))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Minutos entre dos horas; 0 si no se pueden leer o es negativo. */
export function minutosEntre(inicio: string, fin: string): number {
  const a = minutosDeHora(inicio)
  const b = minutosDeHora(fin)
  if (a === null || b === null) return 0
  return b > a ? b - a : 0
}

const CAMPOS_COMPARADOS = [
  'nombre',
  'descripcion',
  'horaInicio',
  'horaFin',
  'direccion',
  'precioEstimado',
  'tipo',
] as const

/**
 * Actividades que cambiaron entre dos versiones del viaje (nuevas, editadas o
 * movidas de día), con el recuento por día (para «3 cambios en el día 3»).
 */
export function cambiosEntre(
  antes: Trip,
  despues: Trip
): { ids: Set<string>; porDia: Map<number, number> } {
  const previas = new Map<string, { act: Activity; dia: number }>()
  antes.dias.forEach((d, i) =>
    d.actividades.forEach((a) => previas.set(a.id, { act: a, dia: i }))
  )
  const ids = new Set<string>()
  const porDia = new Map<number, number>()
  despues.dias.forEach((d, i) => {
    for (const a of d.actividades) {
      const previa = previas.get(a.id)
      const cambio =
        !previa ||
        previa.dia !== i ||
        CAMPOS_COMPARADOS.some((k) => previa.act[k] !== a[k])
      if (cambio) {
        ids.add(a.id)
        porDia.set(i + 1, (porDia.get(i + 1) ?? 0) + 1)
      }
    }
  })
  // Actividades quitadas: cuentan como cambio en su día original.
  const actuales = new Set(
    despues.dias.flatMap((d) => d.actividades.map((a) => a.id))
  )
  for (const [id, { dia }] of previas) {
    if (!actuales.has(id)) porDia.set(dia + 1, (porDia.get(dia + 1) ?? 0) + 1)
  }
  return { ids, porDia }
}

/** Texto del toast: «3 cambios en el día 3» · «5 cambios en 2 días». */
export function resumenDeCambios(porDia: Map<number, number>): string {
  const total = [...porDia.values()].reduce((s, n) => s + n, 0)
  if (total === 0) return 'Sin cambios en el itinerario'
  const cambios = total === 1 ? '1 cambio' : `${total} cambios`
  if (porDia.size === 1) {
    const [dia] = [...porDia.keys()]
    return `${cambios} en el día ${dia}`
  }
  return `${cambios} en ${porDia.size} días`
}

export interface LugarAGeocodificar {
  id: string
  nombre: string
  ciudad: string
}

/**
 * Coordenadas reales para actividades nuevas o editadas (POST /api/geocode,
 * en lotes de 10). Best-effort: nunca lanza.
 */
export async function geocodificar(
  lugares: LugarAGeocodificar[],
  signal?: AbortSignal
): Promise<Map<string, { lat: number; lng: number }>> {
  const coords = new Map<string, { lat: number; lng: number }>()
  const validos = lugares.filter((l) => l.nombre.trim()).slice(0, 30)
  for (let i = 0; i < validos.length; i += 10) {
    const lote = validos.slice(i, i + 10)
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lote.map((l) => ({ nombre: l.nombre, ciudad: l.ciudad })),
        }),
        ...(signal ? { signal } : {}),
      })
      if (!res.ok) break
      const { results } = (await res.json()) as {
        results?: ({ lat: number; lng: number } | null)[]
      }
      lote.forEach((l, j) => {
        const r = results?.[j]
        if (r && Number.isFinite(r.lat) && Number.isFinite(r.lng)) {
          coords.set(l.id, { lat: r.lat, lng: r.lng })
        }
      })
    } catch {
      break
    }
  }
  return coords
}

/** Aplica coordenadas geocodificadas a un viaje (inmutable). */
export function aplicarCoords(
  trip: Trip,
  coords: Map<string, { lat: number; lng: number }>
): Trip {
  if (coords.size === 0) return trip
  return {
    ...trip,
    dias: trip.dias.map((d) => ({
      ...d,
      actividades: d.actividades.map((a) => {
        const c = coords.get(a.id)
        return c ? { ...a, ...c, coordsVerificadas: true } : a
      }),
    })),
  }
}

/** Actividades sin coordenadas verificadas (para geocodificar). */
export function lugaresSinVerificar(
  trip: Trip,
  soloIds?: ReadonlySet<string>
): LugarAGeocodificar[] {
  const out: LugarAGeocodificar[] = []
  for (const d of trip.dias) {
    for (const a of d.actividades) {
      if (soloIds && !soloIds.has(a.id)) continue
      if (
        a.coordsVerificadas ||
        a.tipo === 'traslado' ||
        !a.nombre.trim() ||
        /check-?(in|out)/i.test(a.nombre)
      ) {
        continue
      }
      out.push({
        id: a.id,
        nombre: a.direccion?.trim() ? `${a.nombre}, ${a.direccion}` : a.nombre,
        ciudad: ciudadDelDia(d, trip),
      })
    }
  }
  return out
}
