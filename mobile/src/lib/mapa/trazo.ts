/**
 * Geometría de las rutas del mapa, portada de la web (TripMap.tsx y
 * mapaCarta.ts): un feature por tramo con su tipo (a pie, traslado o por mar),
 * respaldo mientras no llega la ruta real y el trazo animado del día (§7.4).
 */
import { distanciaMetros } from '../geofencing/geodesia'
import {
  claveTramo,
  modoForzado,
  tieneCoords,
  type ModoTramo,
  type ParadaRuta,
  type RutaTramo,
} from './rutas'

/** Duración del trazo de la ruta al elegir un día (§7.4). */
export const TRAZO_MS = 600
/** Opacidad del día activo bajo el trazo (la misma de los demás días). */
export const OPACIDAD_GUIA = 0.3

export type TipoTramo = 'normal' | 'traslado' | 'crucero'

export interface PropsTramo {
  color: string
  /** 1 o 0,3 si hay un día enfocado y no es este. */
  opacidad: number
  /** Es el día enfocado (más grueso; es el que se traza). */
  activo: boolean
  tipo: TipoTramo
  /** Día (1…). */
  dia: number
}

export type RutasMapa = GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  PropsTramo
>

export const SIN_RUTAS: RutasMapa = { type: 'FeatureCollection', features: [] }

/**
 * Arco suave entre dos puntos (bezier cuadrática), en una proyección local
 * equirectangular para que la curvatura no se deforme con la latitud.
 */
export function arcoEntre(
  a: [number, number],
  b: [number, number],
  lado: 1 | -1,
  intensidad = 0.14,
  pasos = 22
): [number, number][] {
  const latMedia = ((a[1] + b[1]) / 2) * (Math.PI / 180)
  const k = Math.max(0.2, Math.cos(latMedia))
  const ax = a[0] * k
  const ay = a[1]
  const bx = b[0] * k
  const by = b[1]
  const dx = bx - ax
  const dy = by - ay
  const largo = Math.hypot(dx, dy)
  if (largo === 0) return [a, b]
  // Punto de control: punto medio desplazado en perpendicular.
  const cx = (ax + bx) / 2 + (-dy / largo) * largo * intensidad * lado
  const cy = (ay + by) / 2 + (dx / largo) * largo * intensidad * lado
  const puntos: [number, number][] = []
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos
    const u = 1 - t
    const x = u * u * ax + 2 * u * t * cx + t * t * bx
    const y = u * u * ay + 2 * u * t * cy + t * t * by
    puntos.push([x / k, y])
  }
  return puntos
}

interface OpcionesRutas {
  /** Color del día por su índice (0 = día 1). */
  colorDeDia: (indice: number) => string
  /** Índice del día enfocado o null para el viaje completo. */
  enfocado: number | null
  crucero: boolean
  /** Rutas reales ya llegadas (useRutasReales). */
  rutas: ReadonlyMap<string, RutaTramo>
}

/**
 * Un feature por tramo entre paradas consecutivas de cada día (en el orden
 * recibido). Usa la ruta por calles si ya llegó; si no (o por mar/aire), un
 * arco suave. Si el servidor no pudo calcularla devuelve la línea recta.
 */
export function featuresRutas(
  dias: readonly (readonly ParadaRuta[])[],
  { colorDeDia, enfocado, crucero, rutas }: OpcionesRutas
): RutasMapa {
  const features: RutasMapa['features'] = []
  dias.forEach((dia, d) => {
    const pts = dia.filter(tieneCoords)
    const color = colorDeDia(d)
    const activo = enfocado === d
    const opacidad = enfocado === null || activo ? 1 : 0.3
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      if (!a || !b) continue
      const forzado = modoForzado(a, b, crucero)
      const real = rutas.get(claveTramo(a, b, forzado))
      // Modo del tramo: el de la ruta real si ya llegó; si no, por distancia.
      const km = distanciaMetros(a.lat, a.lng, b.lat, b.lng) / 1000
      const modo: ModoTramo =
        real?.modo ??
        forzado ??
        (km > 250 ? 'directo' : km <= 1.6 ? 'pie' : 'auto')
      const tipo: TipoTramo =
        modo === 'directo' && crucero
          ? 'crucero'
          : a.tipo === 'traslado' || b.tipo === 'traslado' || modo !== 'pie'
            ? 'traslado'
            : 'normal'
      const coordinates =
        real && real.modo !== 'directo' && real.coords.length >= 2
          ? real.coords
          : arcoEntre(
              [a.lng, a.lat],
              [b.lng, b.lat],
              1,
              tipo === 'normal' ? 0.14 : 0.2
            )
      features.push({
        type: 'Feature',
        properties: { color, opacidad, activo, tipo, dia: d + 1 },
        geometry: { type: 'LineString', coordinates },
      })
    }
  })
  return { type: 'FeatureCollection', features }
}

// ── Trazo del día (§7.4) ────────────────────────────────────────────────────

/** Distancia aproximada en grados (longitud escalada por la latitud). */
function distanciaPlana(a: GeoJSON.Position, b: GeoJSON.Position): number {
  const [x1 = 0, y1 = 0] = a
  const [x2 = 0, y2 = 0] = b
  const k = Math.cos((((y1 + y2) / 2) * Math.PI) / 180)
  return Math.hypot((x2 - x1) * k, y2 - y1)
}

function largoLinea(coords: GeoJSON.Position[]): number {
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]
    const b = coords[i]
    if (a && b) total += distanciaPlana(a, b)
  }
  return total
}

/** El principio de la línea hasta `largo` (corta el último segmento). */
function cortarLinea(
  coords: GeoJSON.Position[],
  largo: number
): GeoJSON.Position[] {
  const primero = coords[0]
  if (!primero) return []
  const salida: GeoJSON.Position[] = [primero]
  let resto = largo
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]
    const b = coords[i]
    if (!a || !b) continue
    const d = distanciaPlana(a, b)
    if (d >= resto) {
      const f = d > 0 ? resto / d : 0
      const [x1 = 0, y1 = 0] = a
      const [x2 = 0, y2 = 0] = b
      salida.push([x1 + (x2 - x1) * f, y1 + (y2 - y1) * f])
      return salida
    }
    salida.push(b)
    resto -= d
  }
  return salida
}

/**
 * Tramos del día activo recortados a la fracción `t` (0..1) de su recorrido,
 * en el orden de las paradas: el trazo avanza de la primera a la última.
 */
export function trazoParcial(rutas: RutasMapa, t: number): RutasMapa {
  const tramos = rutas.features.filter((f) => f.properties.activo)
  const largos = tramos.map((f) => largoLinea(f.geometry.coordinates))
  const total = largos.reduce((suma, l) => suma + l, 0)
  let resto = total * Math.min(1, Math.max(0, t))
  const features: RutasMapa['features'] = []
  for (let i = 0; i < tramos.length && resto > 0; i++) {
    const tramo = tramos[i]
    const largo = largos[i] ?? 0
    if (!tramo) continue
    if (largo <= resto) {
      features.push(tramo)
      resto -= largo
      continue
    }
    const coordinates = cortarLinea(tramo.geometry.coordinates, resto)
    if (coordinates.length >= 2) {
      features.push({ ...tramo, geometry: { type: 'LineString', coordinates } })
    }
    break
  }
  return { type: 'FeatureCollection', features }
}

/** Curva ease-tinta, cubic-bezier(.65, 0, .35, 1) (§7.1): trazos A→B. */
export function easeTinta(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}
