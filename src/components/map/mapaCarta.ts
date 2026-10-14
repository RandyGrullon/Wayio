import type { LayerSpecification } from 'maplibre-gl'

/**
 * Refinamientos de la «carta» de Wayio sobre el estilo base de OpenFreeMap:
 *
 *  - Base más limpia: sin escudos de carretera, sin puntos de interés ni
 *    números de portal; el agua rotulada en itálica color mar, como en una
 *    carta náutica. Así destaca la ruta del viajero y no el mapa.
 *  - Rutas curvas (arcos suaves en lugar de rectas) con chevrones que marcan
 *    el sentido del recorrido.
 *  - Separación de marcadores que se pisan en pantalla.
 *
 * Funciones puras (salvo separarMarcadores, que solo mueve offsets).
 */

export type TemaCarta = 'light' | 'dark'

type CapaLibre = LayerSpecification & {
  paint?: Record<string, unknown>
  layout?: Record<string, unknown>
  'source-layer'?: string
}

/** Color de las etiquetas de agua (mar), AA sobre el agua de cada tema. */
const ETIQUETA_AGUA: Record<TemaCarta, string> = {
  light: '#1E5A57',
  dark: '#7FBFB6',
}

/**
 * Decide qué hacer con una capa del estilo base: null = quitarla.
 * Se llama DESPUÉS de aplicar la paleta (ajustarCapa).
 */
export function refinarCapaBase(
  capa: LayerSpecification,
  tema: TemaCarta
): LayerSpecification | null {
  const libre = capa as CapaLibre
  const id = capa.id.toLowerCase()
  const fuente = (libre['source-layer'] ?? '').toLowerCase()
  const layout = { ...(libre.layout ?? {}) }

  if (capa.type === 'symbol') {
    // Escudos de carretera, puntos de interés, números de portal y aeropuertos
    // pequeños: ruido para un itinerario.
    if (
      /shield|poi|housenum|house_num|aerodrome|airport_label|transit|railway_station/.test(
        id
      ) ||
      fuente === 'poi' ||
      fuente === 'housenumber'
    ) {
      return null
    }
    // Agua: itálica en color mar.
    if (
      /water|ocean|sea|lake|river|marine/.test(id) ||
      fuente.includes('water')
    ) {
      const fuentes = layout['text-font']
      const italica = Array.isArray(fuentes)
        ? fuentes.map((f) =>
            typeof f === 'string' ? f.replace(/(Regular|Bold)$/, 'Italic') : f
          )
        : ['Noto Sans Italic']
      return {
        ...libre,
        layout: {
          ...layout,
          'text-font': italica,
          'text-letter-spacing': 0.08,
        },
        paint: {
          ...(libre.paint ?? {}),
          'text-color': ETIQUETA_AGUA[tema],
          'text-halo-width': 0,
        },
      } as LayerSpecification
    }
    // Menos densidad en etiquetas de calles: solo a partir de zoom 15.
    if (/road|street|highway|transportation_name/.test(id)) {
      return {
        ...libre,
        minzoom: Math.max(libre.minzoom ?? 0, 15),
      } as LayerSpecification
    }
  }
  return capa
}

/** Color de la flecha de sentido sobre la línea del día (= casing). */
const COLOR_FLECHA: Record<TemaCarta, string> = {
  light: '#FFFFFF',
  dark: '#0B1622',
}

/** Imagen de una flecha «›» gruesa, dibujada en canvas (apunta a +x). */
function dibujarFlecha(color: string): ImageData | null {
  if (typeof document === 'undefined') return null
  const lienzo = document.createElement('canvas')
  lienzo.width = 24
  lienzo.height = 24
  const g = lienzo.getContext('2d')
  if (!g) return null
  g.strokeStyle = color
  g.lineWidth = 3.4
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.beginPath()
  g.moveTo(9, 6.5)
  g.lineTo(15, 12)
  g.lineTo(9, 17.5)
  g.stroke()
  return g.getImageData(0, 0, 24, 24)
}

/** Mapa mínimo para registrar las flechas bajo demanda. */
interface MapaConImagenes {
  addImage(
    id: string,
    image: ImageData,
    options?: { pixelRatio?: number }
  ): unknown
  hasImage(id: string): boolean
  on(evento: 'styleimagemissing', cb: (e: { id: string }) => void): unknown
  off(evento: 'styleimagemissing', cb: (e: { id: string }) => void): unknown
}

/**
 * Registra las flechas cuando el estilo las pide (también tras un setStyle
 * por cambio de tema). Devuelve la función para dejar de escuchar.
 */
export function registrarFlechas(map: MapaConImagenes): () => void {
  const alFaltar = (e: { id: string }) => {
    const tema =
      e.id === 'wy-flecha-light'
        ? 'light'
        : e.id === 'wy-flecha-dark'
          ? 'dark'
          : null
    if (!tema || map.hasImage(e.id)) return
    const img = dibujarFlecha(COLOR_FLECHA[tema])
    if (img) map.addImage(e.id, img, { pixelRatio: 2 })
  }
  map.on('styleimagemissing', alFaltar)
  return () => {
    map.off('styleimagemissing', alFaltar)
  }
}

/**
 * Flechas de sentido a lo largo de las rutas normales, encima de la línea
 * del día y con su misma opacidad (los días atenuados quedan atenuados).
 */
export function capaChevrones(
  fuenteRutas: string,
  tema: TemaCarta,
  visible: boolean
): LayerSpecification {
  return {
    id: 'wy-rutas-sentido',
    type: 'symbol',
    source: fuenteRutas,
    filter: ['==', ['get', 'tipo'], 'normal'],
    minzoom: 12.5,
    layout: {
      visibility: visible ? 'visible' : 'none',
      'symbol-placement': 'line',
      'symbol-spacing': 70,
      'icon-image': `wy-flecha-${tema}`,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 12.5, 0.6, 16, 0.95],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-opacity': ['get', 'opacidad'],
    },
  } as LayerSpecification
}

/**
 * Arco suave entre dos puntos (bezier cuadrática), en una proyección local
 * equirectangular para que la curvatura no se deforme con la latitud.
 * `lado` alterna el sentido de la curva entre tramos consecutivos.
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
  // a coordenadas locales (x escalada por cos(lat))
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

/** Interfaz mínima de marcador para separarlos en pantalla. */
interface MarcadorSeparable {
  marker: {
    getLngLat(): { lng: number; lat: number }
    setOffset(o: [number, number]): unknown
  }
}

/**
 * Separa los marcadores que quedan a menos de `minPx` en pantalla,
 * repartiéndolos en un pequeño círculo alrededor de su centro común. Se
 * llama al terminar zoom/movimiento; no mueve sus coordenadas reales.
 */
export function separarMarcadores(
  proyectar: (lngLat: { lng: number; lat: number }) => { x: number; y: number },
  marcadores: MarcadorSeparable[],
  minPx = 26
): void {
  const pos = marcadores.map((m) => proyectar(m.marker.getLngLat()))
  const grupo = new Array<number>(marcadores.length).fill(-1)
  let siguiente = 0
  for (let i = 0; i < pos.length; i++) {
    if (grupo[i] !== -1) continue
    grupo[i] = siguiente
    const pi = pos[i]
    if (!pi) continue
    for (let j = i + 1; j < pos.length; j++) {
      const pj = pos[j]
      if (!pj || grupo[j] !== -1) continue
      if (Math.hypot(pi.x - pj.x, pi.y - pj.y) < minPx) grupo[j] = siguiente
    }
    siguiente++
  }
  const miembros = new Map<number, number[]>()
  grupo.forEach((g, i) => miembros.set(g, [...(miembros.get(g) ?? []), i]))
  for (const indices of miembros.values()) {
    if (indices.length === 1) {
      const m = marcadores[indices[0] as number]
      m?.marker.setOffset([0, 0])
      continue
    }
    const radio = Math.max(16, (minPx * indices.length) / (2 * Math.PI))
    indices.forEach((idx, n) => {
      const ang = (2 * Math.PI * n) / indices.length - Math.PI / 2
      marcadores[idx]?.marker.setOffset([
        Math.round(Math.cos(ang) * radio),
        Math.round(Math.sin(ang) * radio),
      ])
    })
  }
}
