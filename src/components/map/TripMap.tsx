'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import maplibregl from 'maplibre-gl'
import type {
  GeoJSONSource,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './tripMap.css'
import {
  CloudOff,
  Focus,
  Layers,
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
} from 'lucide-react'
import type { Day } from '@/types/trip'
import type { Activity } from '@/types/activity'
import type { UserLocation } from '@/types/geofencing'
import { iniciales } from '@/components/ui/Avatar'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { dayColor, diaClases } from '@/constants/mapColors'
import type { TemaMapa } from '@/constants/mapColors'
import { buildNavigationLinks } from '@/constants/affiliateLinks'
import { formatCurrency, formatHora12 } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { prefiereMenosMovimiento, useTemaMapa } from './useTemaMapa'
import {
  arcoEntre,
  capaChevrones,
  refinarCapaBase,
  registrarFlechas,
  separarMarcadores,
} from './mapaCarta'
import {
  claveTramo,
  modoForzado,
  useRutasReales,
  type RutaTramo,
} from './useRutasReales'
import { haversineKm } from '@/lib/ai/normalize'

/**
 * Mapa del viaje (docs/DISENO.md §10).
 *
 * - Estilos OpenFreeMap positron (claro) y dark (oscuro) con la paleta de la
 *   carta de Wayio aplicada al cargar (fondo, agua, parques, vías y etiquetas
 *   AA). Al cambiar de tema se hace setStyle con diff y se conservan las capas
 *   propias.
 * - El mapa NO se recrea al cambiar los días: rutas y círculos se actualizan
 *   con source.setData() y los marcadores se reutilizan por actividad.
 * - Fichas (popups) construidas con nodos DOM y textContent, nunca con HTML
 *   (corrige el XSS API-04). Enlaces externos con rel="noopener noreferrer".
 * - Punto GPS con halo de 3 ciclos tras cada actualización y círculo de
 *   precisión; tramo «en vivo» hasta la siguiente parada.
 */

export interface TripMapProps {
  dias: Day[]
  userLocation?: UserLocation | undefined
  /** Actividad con su geocerca visible (círculo de su radio). */
  actividadActiva?: Activity | undefined
  isCrucero?: boolean
  className?: string
  /**
   * Día enfocado (0 = día 1) o null para el viaje completo. Si se pasa, el
   * mapa queda controlado desde fuera y no muestra su selector de días.
   */
  diaEnfocado?: number | null
  /** Siguiente parada en vivo: dibuja el tramo GPS → parada. */
  siguiente?: { lat: number; lng: number } | null
  /** Vuela a esta actividad y abre su ficha (p. ej. el puerto). */
  enfocarActividadId?: string | null
  /** Moneda de los importes de las fichas (la del viaje). */
  moneda?: string
  /**
   * Aún llegan coordenadas verificadas (geocodificación de fondo): con
   * Geoapify no se piden las rutas hasta que acabe, y mientras tanto el mapa
   * dibuja arcos.
   */
  rutasEnPausa?: boolean
  /**
   * Gestos cooperativos (dos dedos para mover el mapa).
   * - 'tactil' (por defecto): solo en pantallas táctiles y con el mapa dentro
   *   de la página, para que un dedo siga haciendo scroll. En pantalla
   *   completa y con ratón el mapa se arrastra, desliza y acerca libre.
   * - false: siempre libre (mapas a pantalla completa o en un modal).
   * - true: siempre cooperativo.
   */
  cooperativo?: boolean | 'tactil'
  /**
   * Miembros del grupo con su última ubicación: avatar-pin con iniciales en
   * el color de su índice (§6.8). Se actualizan sin recrear el mapa.
   */
  miembros?: MiembroMapa[]
  /** Nombre accesible del mapa. */
  etiqueta?: string
  /** Contenido extra sobre el mapa (p. ej. «Ampliar mapa»). */
  children?: ReactNode
}

export interface MiembroMapa {
  id: string
  nombre: string
  lat: number
  lng: number
  /** Índice estable del miembro (indiceDesdeId): fija su color. */
  index: number
}

type Estado = 'inactivo' | 'listo' | 'error'
type TipoTramo = 'normal' | 'traslado' | 'crucero'

interface Datos {
  rutas: GeoJSON.FeatureCollection
  gps: GeoJSON.FeatureCollection
  tramo: GeoJSON.FeatureCollection
  geocerca: GeoJSON.FeatureCollection
}

interface Marcador {
  marker: maplibregl.Marker
  raiz: HTMLDivElement
  punto: HTMLSpanElement
}

// ── Estilos y paleta ────────────────────────────────────────────────────────

const ESTILO_URL: Record<TemaMapa, string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}

/**
 * Créditos del proveedor de rutas y geocodificación (los del mapa base los
 * añade MapLibre desde el estilo). WAYIO_GEO_PROVEEDOR lo fija next.config.ts
 * al compilar: 'geoapify' si el servidor tiene GEOAPIFY_API_KEY (la clave
 * nunca llega al navegador) u 'osm' con Nominatim + OSRM de FOSSGIS.
 *
 * Geoapify exige en su plan Free un enlace «Powered by Geoapify» sin nofollow
 * y el crédito de OpenStreetMap. Este último no se repite aquí: la fuente
 * vectorial de OpenFreeMap ya lo trae en su TileJSON («Data from
 * OpenStreetMap», enlazado a openstreetmap.org/copyright).
 */
const CREDITOS_GEO =
  process.env.WAYIO_GEO_PROVEEDOR === 'geoapify'
    ? 'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener">Geoapify</a>'
    : 'Rutas: OSRM · FOSSGIS'

interface Paleta {
  fondo: string
  agua: string
  parque: string
  residencial: string
  edificio: string
  etiqueta: string
  halo: string
  viaMenor: string
  viaMayor: string
  viaCasing: string
  casing: string
  gps: string
  acento: string
}

/** Colores del fork de la carta (§10.1). Etiquetas: 6,71 y 9,79 (§4.3). */
const PALETAS: Record<TemaMapa, Paleta> = {
  light: {
    fondo: '#EFEBE3',
    agua: '#CDDCDF',
    parque: '#E3E6DA',
    residencial: '#E9E4DA',
    edificio: '#E4DED2',
    etiqueta: '#46525F',
    halo: '#FFFFFF',
    viaMenor: '#FFFFFF',
    viaMayor: '#FFFFFF',
    viaCasing: '#E2DCD0',
    casing: '#FFFFFF',
    gps: '#C21A66',
    acento: '#1E5A57',
  },
  dark: {
    fondo: '#0E1925',
    agua: '#10283A',
    parque: '#13222C',
    residencial: '#112131',
    edificio: '#132030',
    etiqueta: '#B6C2CE',
    halo: 'rgba(11, 22, 34, 0.8)',
    viaMenor: '#18293B',
    viaMayor: '#1F344A',
    viaCasing: '#22384D',
    casing: '#0B1622',
    gps: '#F55A9A',
    acento: '#7FBFB6',
  },
}

const FUENTE_RUTAS = 'wy-rutas'
const FUENTE_GPS = 'wy-gps'
const FUENTE_TRAMO = 'wy-tramo'
const FUENTE_GEOCERCA = 'wy-geocerca'
const CAPAS_RUTAS = [
  'wy-rutas-casing',
  'wy-rutas-normal',
  'wy-rutas-traslado',
  'wy-rutas-crucero',
  'wy-rutas-sentido',
] as const

const VACIO: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

const LOCALE_ES: Record<string, string> = {
  'Marker.Title': 'Parada del viaje',
  'Popup.Close': 'Cerrar ficha',
  'AttributionControl.ToggleAttribution': 'Mostrar los créditos del mapa',
  'AttributionControl.MapFeedback': 'Sugerencias sobre el mapa',
  'NavigationControl.ZoomIn': 'Acercar',
  'NavigationControl.ZoomOut': 'Alejar',
  'CooperativeGesturesHandler.WindowsHelpText':
    'Usa Ctrl + rueda para acercar el mapa',
  'CooperativeGesturesHandler.MacHelpText':
    'Usa ⌘ + rueda para acercar el mapa',
  'CooperativeGesturesHandler.MobileHelpText':
    'Usa dos dedos para mover el mapa',
}

const cacheEstilos = new Map<string, Promise<StyleSpecification>>()

function cargarEstilo(tema: TemaMapa): Promise<StyleSpecification> {
  const url = ESTILO_URL[tema]
  const enCache = cacheEstilos.get(url)
  if (enCache) return enCache
  const promesa = fetch(url).then((r) => {
    if (!r.ok) throw new Error('estilo no disponible')
    return r.json() as Promise<StyleSpecification>
  })
  cacheEstilos.set(url, promesa)
  promesa.catch(() => cacheEstilos.delete(url))
  return promesa
}

type CapaLibre = LayerSpecification & {
  paint?: Record<string, unknown>
  layout?: Record<string, unknown>
}

/** Aplica la paleta de la carta a una capa del estilo base. */
function ajustarCapa(
  capa: LayerSpecification,
  pal: Paleta
): LayerSpecification {
  const libre = capa as CapaLibre
  const id = capa.id.toLowerCase()
  const paint: Record<string, unknown> = { ...(libre.paint ?? {}) }
  const layout = libre.layout ?? {}
  switch (capa.type) {
    case 'background':
      paint['background-color'] = pal.fondo
      break
    case 'fill':
      if (/water|ocean|lake|river/.test(id)) paint['fill-color'] = pal.agua
      else if (/park|wood|forest|grass|landcover/.test(id))
        paint['fill-color'] = pal.parque
      else if (/residential|landuse/.test(id))
        paint['fill-color'] = pal.residencial
      else if (/building/.test(id)) paint['fill-color'] = pal.edificio
      else return capa
      break
    case 'line':
      if (/water|river|stream|canal/.test(id)) {
        paint['line-color'] = pal.agua
        break
      }
      if (
        !/highway|road|street|motorway|trunk|primary|secondary|tertiary|minor/.test(
          id
        ) ||
        /rail|path|aeroway|ferry|boundary|admin|pier/.test(id)
      ) {
        return capa
      }
      paint['line-color'] = /casing/.test(id)
        ? pal.viaCasing
        : /minor|service|track|street|tertiary/.test(id)
          ? pal.viaMenor
          : pal.viaMayor
      break
    case 'symbol':
      if (!('text-field' in layout)) return capa
      paint['text-color'] = pal.etiqueta
      paint['text-halo-color'] = pal.halo
      if (paint['text-halo-width'] === undefined) paint['text-halo-width'] = 1.2
      break
    default:
      return capa
  }
  return { ...libre, paint } as LayerSpecification
}

function capasPropias(
  tema: TemaMapa,
  rutasVisibles: boolean
): LayerSpecification[] {
  const pal = PALETAS[tema]
  const visibility = rutasVisibles ? 'visible' : 'none'
  const activo = ['==', ['get', 'activo'], true]
  return [
    {
      id: 'wy-geocerca-relleno',
      type: 'fill',
      source: FUENTE_GEOCERCA,
      paint: { 'fill-color': pal.acento, 'fill-opacity': 0.12 },
    },
    {
      id: 'wy-geocerca-borde',
      type: 'line',
      source: FUENTE_GEOCERCA,
      paint: { 'line-color': pal.acento, 'line-width': 2, 'line-opacity': 0.7 },
    },
    {
      id: 'wy-rutas-casing',
      type: 'line',
      source: FUENTE_RUTAS,
      filter: ['==', ['get', 'tipo'], 'normal'],
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility },
      paint: {
        'line-color': pal.casing,
        'line-width': ['case', activo, 7.5, 6],
        'line-opacity': ['get', 'opacidad'],
      },
    },
    {
      id: 'wy-rutas-normal',
      type: 'line',
      source: FUENTE_RUTAS,
      filter: ['==', ['get', 'tipo'], 'normal'],
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', activo, 4.5, 3.5],
        'line-opacity': ['get', 'opacidad'],
      },
    },
    {
      id: 'wy-rutas-traslado',
      type: 'line',
      source: FUENTE_RUTAS,
      filter: ['==', ['get', 'tipo'], 'traslado'],
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 3.5,
        'line-dasharray': [0.1, 2],
        'line-opacity': ['get', 'opacidad'],
      },
    },
    {
      id: 'wy-rutas-crucero',
      type: 'line',
      source: FUENTE_RUTAS,
      filter: ['==', ['get', 'tipo'], 'crucero'],
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 2.5,
        'line-dasharray': [2, 2],
        'line-opacity': ['get', 'opacidad'],
      },
    },
    {
      id: 'wy-tramo',
      type: 'line',
      source: FUENTE_TRAMO,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': pal.gps,
        'line-width': 4,
        'line-dasharray': [1.5, 1.5],
      },
    },
    {
      id: 'wy-gps-relleno',
      type: 'fill',
      source: FUENTE_GPS,
      paint: { 'fill-color': pal.gps, 'fill-opacity': 0.1 },
    },
    {
      id: 'wy-gps-borde',
      type: 'line',
      source: FUENTE_GPS,
      paint: { 'line-color': pal.gps, 'line-opacity': 0.35, 'line-width': 1.5 },
    },
  ] as LayerSpecification[]
}

function fuentesPropias(d: Datos): Record<string, SourceSpecification> {
  return {
    [FUENTE_RUTAS]: { type: 'geojson', data: d.rutas },
    [FUENTE_GPS]: { type: 'geojson', data: d.gps },
    [FUENTE_TRAMO]: { type: 'geojson', data: d.tramo },
    [FUENTE_GEOCERCA]: { type: 'geojson', data: d.geocerca },
  }
}

function componerEstilo(
  base: StyleSpecification,
  tema: TemaMapa,
  datos: Datos,
  rutasVisibles: boolean
): StyleSpecification {
  const pal = PALETAS[tema]
  const capasBase = base.layers
    .map((c) => refinarCapaBase(ajustarCapa(c, pal), tema))
    .filter((c): c is LayerSpecification => c !== null)
  return {
    ...base,
    sources: { ...base.sources, ...fuentesPropias(datos) },
    layers: [
      ...capasBase,
      ...capasPropias(tema, rutasVisibles),
      // Flechas del sentido del recorrido, encima de las rutas.
      capaChevrones(FUENTE_RUTAS, tema, rutasVisibles),
    ],
  }
}

// ── Geometría ───────────────────────────────────────────────────────────────

function tieneCoords(a: Pick<Activity, 'lat' | 'lng'>): boolean {
  return (
    Number.isFinite(a.lat) &&
    Number.isFinite(a.lng) &&
    !(a.lat === 0 && a.lng === 0)
  )
}

function circulo(
  lat: number,
  lng: number,
  metros: number
): GeoJSON.FeatureCollection {
  const puntos = 64
  const dLat = metros / 111_320
  const dLng =
    metros / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)))
  const anillo: GeoJSON.Position[] = []
  for (let i = 0; i <= puntos; i++) {
    const ang = ((i % puntos) * 2 * Math.PI) / puntos
    anillo.push([lng + dLng * Math.sin(ang), lat + dLat * Math.cos(ang)])
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [anillo] },
      },
    ],
  }
}

function featuresRutas(
  dias: Day[],
  tema: TemaMapa,
  enfocado: number | null,
  crucero: boolean,
  rutas: ReadonlyMap<string, RutaTramo>
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  dias.forEach((dia, d) => {
    const pts = dia.actividades.filter(tieneCoords)
    const color = dayColor(d, tema)
    const activo = enfocado === d
    const opacidad = enfocado === null || activo ? 1 : 0.3
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      if (!a || !b) continue
      const forzado = modoForzado(a, b, crucero)
      const real = rutas.get(claveTramo(a, b, forzado))
      // Modo del tramo: el de la ruta real si ya llegó; si no, por distancia.
      const km = haversineKm(a, b)
      const modo =
        real?.modo ??
        forzado ??
        (km > 250 ? 'directo' : km <= 1.6 ? 'pie' : 'auto')
      const tipo: TipoTramo =
        modo === 'directo' && crucero
          ? 'crucero'
          : a.tipo === 'traslado' || b.tipo === 'traslado' || modo !== 'pie'
            ? 'traslado'
            : 'normal'
      // Ruta exacta por calles (a pie o en carro) cuando el servicio de rutas
      // la devuelve; mientras tanto, o por mar/aire, un arco suave.
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

function puntosDe(dias: Day[], dia: number | null): [number, number][] {
  const lista = dia === null ? dias : dias.slice(dia, dia + 1)
  return lista.flatMap((d) =>
    d.actividades
      .filter(tieneCoords)
      .map((a): [number, number] => [a.lng, a.lat])
  )
}

/** Encuadra el día (o el viaje). Movimiento reducido: sin animación. */
function ajustarVista(
  map: maplibregl.Map,
  dias: Day[],
  dia: number | null,
  instantaneo: boolean
): void {
  let puntos = puntosDe(dias, dia)
  if (puntos.length === 0 && dia !== null) puntos = puntosDe(dias, null)
  const primero = puntos[0]
  if (!primero) return
  const duration = instantaneo || prefiereMenosMovimiento() ? 0 : 900
  const alto = map.getContainer().clientHeight
  const margen = Math.max(24, Math.min(60, Math.round(alto / 5)))
  if (puntos.length === 1) {
    map.flyTo({
      center: primero,
      zoom: 15,
      duration,
      curve: 1.42,
      essential: true,
    })
    return
  }
  const limites = new maplibregl.LngLatBounds(primero, primero)
  for (const p of puntos) limites.extend(p)
  // maxZoom 16 (la spec decía 14): los días de un casco histórico caben en
  // pocas cuadras y a 14 se veían diminutos.
  map.fitBounds(limites, {
    padding: margen,
    maxZoom: 16,
    duration,
    curve: 1.42,
    essential: true,
  })
}

// ── Piezas DOM (siempre con textContent, nunca HTML) ────────────────────────

function nodo<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  clase: string,
  texto?: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  el.className = clase
  if (texto !== undefined) el.textContent = texto
  return el
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Icono «Anchor» de lucide construido con nodos SVG. */
function iconoAncla(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  for (const d of ['M12 22V8', 'M5 12H2a10 10 0 0 0 20 0h-3']) {
    const p = document.createElementNS(SVG_NS, 'path')
    p.setAttribute('d', d)
    svg.append(p)
  }
  const c = document.createElementNS(SVG_NS, 'circle')
  c.setAttribute('cx', '12')
  c.setAttribute('cy', '5')
  c.setAttribute('r', '3')
  svg.append(c)
  return svg
}

function construirFicha(
  act: Activity,
  dia: number,
  orden: number,
  moneda: string
): HTMLElement {
  const raiz = nodo('div', 'flex max-w-[252px] flex-col gap-1 pr-7')
  raiz.append(
    nodo(
      'p',
      'kicker',
      `Día ${String(dia + 1).padStart(2, '0')} · Parada ${orden}`
    )
  )
  raiz.append(
    nodo('p', 'text-[15px] leading-snug font-semibold text-fg', act.nombre)
  )
  const horas = [formatHora12(act.horaInicio), formatHora12(act.horaFin)]
    .filter(Boolean)
    .join(' – ')
  const meta = [
    horas,
    act.precioEstimado > 0 ? formatCurrency(act.precioEstimado, moneda) : '',
  ]
    .filter(Boolean)
    .join(' · ')
  if (meta) raiz.append(nodo('p', 'text-caption text-fg-muted tnum', meta))
  if (act.direccion) {
    raiz.append(nodo('p', 'text-caption text-fg-muted', act.direccion))
  }
  const nav = buildNavigationLinks(act.lat, act.lng, act.nombre)
  const acciones = nodo('div', '-ml-2.5 mt-1.5 flex flex-wrap')
  const enlaces: Array<[string, string]> = [
    ['Google Maps', nav.google],
    ['Waze', nav.waze],
    ['Apple Maps', nav.apple],
  ]
  for (const [texto, url] of enlaces) {
    const a = nodo(
      'a',
      buttonClasses({ variant: 'ghost', size: 'sm', className: 'px-2.5' }),
      texto
    )
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    acciones.append(a)
  }
  raiz.append(acciones)
  return raiz
}

function pintarMarcador(
  m: Marcador,
  act: Activity,
  dia: number,
  orden: number,
  enfocado: number | null,
  puerto: boolean,
  moneda: string
): void {
  const { raiz, punto, marker } = m
  raiz.setAttribute(
    'aria-label',
    `Día ${dia + 1}, actividad ${orden}: ${act.nombre}${puerto ? ' (puerto del crucero)' : ''}`
  )
  raiz.style.setProperty('--wy-c', `var(--dia-${(dia % 10) + 1})`)
  raiz.toggleAttribute('data-activo', enfocado === dia)
  raiz.toggleAttribute('data-atenuado', enfocado !== null && enfocado !== dia)
  raiz.classList.toggle('wy-marcador--puerto', puerto)
  // Primera parada del día: aro de origen (el mismo lenguaje que el logo).
  raiz.toggleAttribute('data-inicio', orden === 1 && !puerto)
  punto.replaceChildren(puerto ? iconoAncla() : String(orden))
  // Etiqueta «9:30 a. m. · Nombre» al pasar el cursor, con foco o en el día
  // activo con zoom cercano (CSS). Siempre con textContent.
  let etiqueta = raiz.querySelector<HTMLSpanElement>('.wy-marcador__etiqueta')
  if (!etiqueta) {
    etiqueta = nodo('span', 'wy-marcador__etiqueta')
    etiqueta.setAttribute('aria-hidden', 'true')
    raiz.append(etiqueta)
  }
  etiqueta.textContent = [formatHora12(act.horaInicio), act.nombre]
    .filter(Boolean)
    .join(' · ')
  marker.setLngLat([act.lng, act.lat])
  marker.getPopup()?.setDOMContent(construirFicha(act, dia, orden, moneda))
}

// ── Componente ──────────────────────────────────────────────────────────────

export function TripMap({
  dias,
  userLocation,
  actividadActiva,
  isCrucero = false,
  className,
  diaEnfocado,
  siguiente = null,
  enfocarActividadId = null,
  moneda = 'USD',
  rutasEnPausa = false,
  cooperativo = 'tactil',
  miembros,
  etiqueta = 'Mapa del viaje',
  children,
}: TripMapProps) {
  const tema = useTemaMapa()
  const contenedorRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const marcadoresRef = useRef<Map<string, Marcador>>(new Map())
  const miembrosRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const gpsRef = useRef<maplibregl.Marker | null>(null)
  const observadorRef = useRef<ResizeObserver | null>(null)
  const temaAplicadoRef = useRef<TemaMapa | null>(null)
  const vistaInicialRef = useRef(false)
  const usuarioMovioRef = useRef(false)

  const [estado, setEstado] = useState<Estado>('inactivo')
  const [intento, setIntento] = useState(0)
  const [diaInterno, setDiaInterno] = useState<number | null>(null)
  const [rutasVisibles, setRutasVisibles] = useState(true)

  // ── Pantalla completa (Fullscreen API o, si no existe —iPhone—, fija) ─────
  const raizRef = useRef<HTMLDivElement | null>(null)
  const [nativa, setNativa] = useState(false)
  const [fija, setFija] = useState(false)
  const ampliado = nativa || fija
  useEffect(() => {
    const alCambiar = () =>
      setNativa(document.fullscreenElement === raizRef.current)
    document.addEventListener('fullscreenchange', alCambiar)
    return () => document.removeEventListener('fullscreenchange', alCambiar)
  }, [])
  useEffect(() => {
    if (!fija) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFija(false)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [fija])
  const alternarPantallaCompleta = () => {
    const el = raizRef.current
    if (!el) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }
    if (fija) {
      setFija(false)
      return
    }
    if (typeof el.requestFullscreen === 'function') {
      el.requestFullscreen().catch(() => setFija(true))
    } else {
      setFija(true)
    }
  }

  const controlado = diaEnfocado !== undefined
  const enfocado = controlado ? diaEnfocado : diaInterno
  const hayCoords = dias.some((d) => d.actividades.some(tieneCoords))
  // Rutas exactas por calles entre paradas (llegan en segundo plano).
  const rutasReales = useRutasReales(dias, isCrucero, rutasEnPausa)

  const datos = useMemo<Datos>(
    () => ({
      rutas: featuresRutas(dias, tema, enfocado, isCrucero, rutasReales),
      gps:
        userLocation &&
        userLocation.accuracy > 0 &&
        userLocation.accuracy < 2000
          ? circulo(userLocation.lat, userLocation.lng, userLocation.accuracy)
          : VACIO,
      tramo:
        userLocation && siguiente
          ? {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: [
                      [userLocation.lng, userLocation.lat],
                      [siguiente.lng, siguiente.lat],
                    ],
                  },
                },
              ],
            }
          : VACIO,
      geocerca:
        actividadActiva && tieneCoords(actividadActiva)
          ? circulo(
              actividadActiva.lat,
              actividadActiva.lng,
              actividadActiva.radioGeofencingMetros || 150
            )
          : VACIO,
    }),
    [
      dias,
      tema,
      enfocado,
      isCrucero,
      rutasReales,
      userLocation,
      siguiente,
      actividadActiva,
    ]
  )

  // Firma de las coordenadas: si cambian (geocodificación de fondo) y el
  // usuario no ha movido el mapa, se vuelve a encuadrar.
  const firmaCoords = useMemo(
    () =>
      puntosDe(dias, null)
        .map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`)
        .join('|'),
    [dias]
  )

  // Copias síncronas para los callbacks del mapa (se actualizan tras pintar).
  const datosRef = useRef(datos)
  const diasRef = useRef(dias)
  const temaRef = useRef(tema)
  const rutasRef = useRef(rutasVisibles)
  const etiquetaRef = useRef(etiqueta)
  useEffect(() => {
    datosRef.current = datos
    diasRef.current = dias
    temaRef.current = tema
    rutasRef.current = rutasVisibles
    etiquetaRef.current = etiqueta
  })

  // ── Creación (una sola vez, cuando hay algo que mostrar) ──────────────────
  useEffect(() => {
    const contenedor = contenedorRef.current
    if (!hayCoords || mapRef.current || !contenedor) return
    let cancelado = false
    const tema0 = temaRef.current
    cargarEstilo(tema0)
      .then((base) => {
        if (cancelado || mapRef.current) return
        const primero = puntosDe(diasRef.current, null)[0] ?? [-69.93, 18.49]
        const map = new maplibregl.Map({
          container: contenedor,
          style: componerEstilo(
            base,
            tema0,
            datosRef.current,
            rutasRef.current
          ),
          center: primero,
          zoom: 12,
          attributionControl: {
            compact: true,
            customAttribution: CREDITOS_GEO,
          },
          // Los gestos cooperativos los decide el efecto de abajo (táctil,
          // en línea o a pantalla completa).
          cooperativeGestures: false,
          // Gestos libres: arrastrar, pellizcar, rueda y doble toque. Sin
          // rotación ni inclinación accidentales (es una carta, no 3D).
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          maxPitch: 0,
          locale: { ...LOCALE_ES, 'Map.Title': etiquetaRef.current },
        })
        map.touchZoomRotate.disableRotation()
        mapRef.current = map
        // Las flechas de sentido se dibujan en canvas cuando el estilo las pide.
        registrarFlechas(map)
        temaAplicadoRef.current = tema0
        const marcarMovimiento = (e: { originalEvent?: unknown }) => {
          if (e.originalEvent) usuarioMovioRef.current = true
        }
        map.on('dragstart', marcarMovimiento)
        map.on('zoomstart', marcarMovimiento)
        map.on('load', () => {
          // Créditos plegados en el botón «i» (MapLibre los abre al cargar
          // y en mapas pequeños tapan los controles propios).
          contenedor
            .querySelector('.maplibregl-ctrl-attrib.maplibregl-compact')
            ?.classList.remove('maplibregl-compact-show')
          setEstado('listo')
        })
        map.on('error', () => {
          // Errores de teselas sueltas: el mapa sigue funcionando.
        })
        const observador = new ResizeObserver(() => map.resize())
        observador.observe(contenedor)
        observadorRef.current = observador
      })
      .catch(() => {
        if (!cancelado) setEstado('error')
      })
    return () => {
      cancelado = true
    }
  }, [hayCoords, intento])

  // ── Destrucción (solo al desmontar) ───────────────────────────────────────
  useEffect(() => {
    const marcadores = marcadoresRef.current
    const pinesMiembros = miembrosRef.current
    return () => {
      observadorRef.current?.disconnect()
      observadorRef.current = null
      marcadores.forEach((m) => m.marker.remove())
      marcadores.clear()
      pinesMiembros.forEach((p) => p.remove())
      pinesMiembros.clear()
      gpsRef.current?.remove()
      gpsRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
      vistaInicialRef.current = false
    }
  }, [])

  // ── Gestos cooperativos: solo táctil + mapa en línea (un dedo = scroll) ───
  useEffect(() => {
    const map = mapRef.current
    if (!map || estado !== 'listo') return
    const mq = window.matchMedia('(pointer: coarse)')
    const aplicar = () => {
      const activar =
        cooperativo === true ||
        (cooperativo === 'tactil' && mq.matches && !ampliado)
      if (activar) map.cooperativeGestures.enable()
      else map.cooperativeGestures.disable()
    }
    aplicar()
    mq.addEventListener('change', aplicar)
    return () => mq.removeEventListener('change', aplicar)
  }, [cooperativo, ampliado, estado])

  // ── Cambio de tema: setStyle con diff, conservando las capas propias ──────
  useEffect(() => {
    const map = mapRef.current
    if (!map || estado !== 'listo' || temaAplicadoRef.current === tema) return
    let cancelado = false
    cargarEstilo(tema)
      .then((base) => {
        if (cancelado || mapRef.current !== map) return
        temaAplicadoRef.current = tema
        map.setStyle(
          componerEstilo(base, tema, datosRef.current, rutasRef.current),
          { diff: true }
        )
      })
      .catch(() => {
        // Sin el estilo nuevo se conserva el anterior.
      })
    return () => {
      cancelado = true
    }
  }, [tema, estado])

  // ── Datos de las capas propias ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || estado !== 'listo') return
    const fijar = (id: string, data: GeoJSON.FeatureCollection) => {
      const fuente = map.getSource(id) as GeoJSONSource | undefined
      fuente?.setData(data)
    }
    fijar(FUENTE_RUTAS, datos.rutas)
    fijar(FUENTE_GPS, datos.gps)
    fijar(FUENTE_TRAMO, datos.tramo)
    fijar(FUENTE_GEOCERCA, datos.geocerca)
  }, [datos, estado])

  useEffect(() => {
    const map = mapRef.current
    if (!map || estado !== 'listo') return
    for (const id of CAPAS_RUTAS) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(
          id,
          'visibility',
          rutasVisibles ? 'visible' : 'none'
        )
      }
    }
  }, [rutasVisibles, estado])

  // ── Marcadores (reutilizados por actividad) ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || estado !== 'listo') return
    const marcadores = marcadoresRef.current
    const vistos = new Set<string>()
    let nuevos = 0
    dias.forEach((dia, d) => {
      let orden = 0
      for (const act of dia.actividades) {
        if (!tieneCoords(act)) continue
        orden += 1
        const clave = `${d}:${act.id}`
        vistos.add(clave)
        const puerto = isCrucero && act.puertoCrucero === true
        let m = marcadores.get(clave)
        if (!m) {
          const raiz = nodo('div', 'wy-marcador')
          const punto = nodo('span', 'wy-marcador__punto')
          raiz.append(punto)
          raiz.style.setProperty(
            '--wy-retraso',
            `${Math.min(nuevos, 20) * 30}ms`
          )
          nuevos += 1
          const popup = new maplibregl.Popup({
            offset: 20,
            maxWidth: '288px',
            className: 'wy-popup',
          })
          // Con la ficha abierta, la etiqueta «hora · nombre» sobra y la tapa.
          popup.on('open', () => raiz.setAttribute('data-ficha', ''))
          popup.on('close', () => raiz.removeAttribute('data-ficha'))
          const marker = new maplibregl.Marker({ element: raiz })
            .setLngLat([act.lng, act.lat])
            .setPopup(popup)
            .addTo(map)
          m = { marker, raiz, punto }
          marcadores.set(clave, m)
        }
        pintarMarcador(m, act, d, orden, enfocado, puerto, moneda)
      }
    })
    for (const [clave, m] of marcadores) {
      if (!vistos.has(clave)) {
        m.marker.remove()
        marcadores.delete(clave)
      }
    }
  }, [dias, enfocado, estado, moneda, isCrucero])

  // ── Marcadores que se pisan: se reparten en círculo (sin mover su lugar) ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || estado !== 'listo') return
    const separar = () =>
      separarMarcadores(
        (ll) => map.project([ll.lng, ll.lat]),
        [...marcadoresRef.current.values()]
      )
    const t = window.setTimeout(separar, 0)
    map.on('zoomend', separar)
    return () => {
      window.clearTimeout(t)
      map.off('zoomend', separar)
    }
  }, [dias, enfocado, estado])

  // ── Encuadre: al estar listo, al cambiar de día y si llegan coordenadas ───
  useEffect(() => {
    const map = mapRef.current
    if (!map || estado !== 'listo') return
    const inicial = !vistaInicialRef.current
    const t = window.setTimeout(
      () => {
        vistaInicialRef.current = true
        ajustarVista(map, diasRef.current, enfocado, inicial)
      },
      inicial ? 0 : 160
    )
    return () => window.clearTimeout(t)
  }, [enfocado, estado])

  useEffect(() => {
    const map = mapRef.current
    if (!map || estado !== 'listo' || usuarioMovioRef.current) return
    if (!vistaInicialRef.current) return
    const t = window.setTimeout(
      () => ajustarVista(map, diasRef.current, enfocado, true),
      250
    )
    return () => window.clearTimeout(t)
    // Solo cuando cambian las coordenadas (no al cambiar de día).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaCoords])

  // ── Vuelo a una actividad concreta (puerto, «Ver en el mapa») ─────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || estado !== 'listo' || !enfocarActividadId) return
    for (const [clave, m] of marcadoresRef.current) {
      if (!clave.endsWith(`:${enfocarActividadId}`)) continue
      const pos = m.marker.getLngLat()
      map.flyTo({
        center: pos,
        zoom: 15,
        duration: prefiereMenosMovimiento() ? 0 : 900,
        curve: 1.42,
        essential: true,
      })
      const popup = m.marker.getPopup()
      if (popup && !popup.isOpen()) m.marker.togglePopup()
      break
    }
  }, [enfocarActividadId, estado])

  // ── Punto GPS ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || estado !== 'listo') return
    if (!userLocation) {
      gpsRef.current?.remove()
      gpsRef.current = null
      return
    }
    let marcador = gpsRef.current
    if (!marcador) {
      const raiz = nodo('div', 'wy-gps')
      raiz.setAttribute('role', 'img')
      raiz.setAttribute('aria-label', 'Estás aquí')
      raiz.append(nodo('span', 'wy-gps__halo'))
      marcador = new maplibregl.Marker({ element: raiz })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map)
      gpsRef.current = marcador
    } else {
      marcador.setLngLat([userLocation.lng, userLocation.lat])
    }
    // Halo de 3 ciclos tras cada actualización (luego queda estático).
    const halo = marcador.getElement().querySelector('.wy-gps__halo')
    if (halo instanceof HTMLElement) {
      halo.classList.remove('animate-ping-gps')
      void halo.offsetWidth
      halo.classList.add('animate-ping-gps')
    }
  }, [userLocation, estado])

  // ── Miembros del grupo: avatar-pin con iniciales (reutilizados por id) ────
  useEffect(() => {
    const map = mapRef.current
    if (!map || estado !== 'listo') return
    const pines = miembrosRef.current
    const vistos = new Set<string>()
    for (const mb of miembros ?? []) {
      if (!tieneCoords(mb)) continue
      vistos.add(mb.id)
      let pin = pines.get(mb.id)
      if (!pin) {
        const raiz = nodo('div', 'wy-miembro')
        raiz.setAttribute('role', 'img')
        raiz.append(nodo('span', 'wy-miembro__avatar'))
        pin = new maplibregl.Marker({ element: raiz, anchor: 'bottom' })
          .setLngLat([mb.lng, mb.lat])
          .addTo(map)
        pines.set(mb.id, pin)
      } else {
        pin.setLngLat([mb.lng, mb.lat])
      }
      const raiz = pin.getElement()
      raiz.setAttribute('aria-label', `${mb.nombre}, última ubicación`)
      raiz.setAttribute('title', mb.nombre)
      raiz.style.setProperty('--wy-c', `var(--dia-${(mb.index % 10) + 1})`)
      const avatar = raiz.querySelector('.wy-miembro__avatar')
      if (avatar) avatar.textContent = iniciales(mb.nombre)
    }
    for (const [id, pin] of pines) {
      if (!vistos.has(id)) {
        pin.remove()
        pines.delete(id)
      }
    }
  }, [miembros, estado])

  const centrarEnMi = () => {
    const map = mapRef.current
    if (!map || !userLocation) return
    map.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 15,
      duration: prefiereMenosMovimiento() ? 0 : 900,
      essential: true,
    })
  }

  const listo = estado === 'listo'

  return (
    <div
      ref={raizRef}
      className={cn(
        'wy-mapa relative isolate overflow-hidden rounded-card bg-surface-2',
        className ?? 'h-full w-full',
        fija && '!fixed !inset-0 z-(--z-modal) !h-dvh !w-screen !rounded-none',
        nativa && '!rounded-none'
      )}
    >
      {/* Estilo en línea: el CSS de MapLibre (sin capa) pone .maplibregl-map
          en position:relative y le gana a la utilidad `absolute` de Tailwind
          (que vive en @layer), dejando el mapa con 0 px de alto. */}
      <div
        ref={contenedorRef}
        className="absolute inset-0"
        style={{ position: 'absolute', inset: 0 }}
      />

      {!hayCoords ? (
        <div className="reticula absolute inset-0 z-10 grid place-items-center bg-surface-2 px-6 text-center">
          <div className="flex max-w-xs flex-col items-center gap-2">
            <MapIcon
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-6 text-fg-muted"
            />
            <p className="text-[15px] font-semibold text-fg">
              Ubicaciones en camino
            </p>
            <p className="text-caption text-fg-muted">
              Todavía no tenemos la ubicación exacta de estas actividades.
              Cuando la tengamos, aparecerán aquí.
            </p>
          </div>
        </div>
      ) : estado === 'error' ? (
        <div
          role="status"
          className="reticula absolute inset-0 z-10 grid place-items-center bg-surface-2 px-6 text-center"
        >
          <div className="flex max-w-xs flex-col items-center gap-2">
            <CloudOff
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-6 text-fg-muted"
            />
            <p className="text-[15px] font-semibold text-fg">
              No pudimos cargar el mapa
            </p>
            <p className="text-caption text-fg-muted">
              Revisa tu conexión. El itinerario sigue disponible.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => {
                setEstado('inactivo')
                setIntento((n) => n + 1)
              }}
            >
              Reintentar
            </Button>
          </div>
        </div>
      ) : !listo ? (
        <div
          role="status"
          className="reticula absolute inset-0 z-10 grid place-items-center bg-surface-2"
        >
          <Skeleton className="absolute inset-0 opacity-60" />
          <div className="relative flex flex-col items-center gap-2 text-fg-muted">
            <MapIcon aria-hidden="true" strokeWidth={1.75} className="size-6" />
            <span className="text-caption">Cargando mapa…</span>
          </div>
        </div>
      ) : null}

      {listo && !controlado && dias.length > 1 ? (
        <div
          role="group"
          aria-label="Ver en el mapa"
          className="absolute top-3 right-16 left-3 z-10 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-print="hide"
        >
          <ChipMapa
            activo={diaInterno === null}
            onClick={() => setDiaInterno(null)}
          >
            Todos
          </ChipMapa>
          {dias.map((dia, i) => (
            <ChipMapa
              key={`${dia.numero}-${i}`}
              activo={diaInterno === i}
              onClick={() => setDiaInterno(i === diaInterno ? null : i)}
              etiqueta={`Día ${i + 1}`}
            >
              <span
                aria-hidden="true"
                className={cn('size-2 rounded-full', diaClases(i).bg)}
              />
              {String(i + 1).padStart(2, '0')}
            </ChipMapa>
          ))}
        </div>
      ) : null}

      {listo ? (
        <div
          className="absolute top-3 right-3 z-10 flex flex-col gap-2"
          data-print="hide"
        >
          {/* En pantallas táctiles se acerca pellizcando: sin +/− caben los
              controles en la franja de 240 px del móvil. */}
          <BotonMapa
            label="Acercar"
            onClick={() => mapRef.current?.zoomIn()}
            className="pointer-coarse:hidden"
          >
            <Plus />
          </BotonMapa>
          <BotonMapa
            label="Alejar"
            onClick={() => mapRef.current?.zoomOut()}
            className="pointer-coarse:hidden"
          >
            <Minus />
          </BotonMapa>
          <BotonMapa
            label="Ajustar vista"
            onClick={() => {
              const map = mapRef.current
              if (!map) return
              usuarioMovioRef.current = false
              ajustarVista(map, dias, enfocado, false)
            }}
          >
            <Focus />
          </BotonMapa>
          <BotonMapa
            label={
              ampliado ? 'Salir de pantalla completa' : 'Pantalla completa'
            }
            pressed={ampliado}
            onClick={alternarPantallaCompleta}
          >
            {ampliado ? <Minimize2 /> : <Maximize2 />}
          </BotonMapa>
          <BotonMapa
            label={rutasVisibles ? 'Ocultar las rutas' : 'Mostrar las rutas'}
            pressed={rutasVisibles}
            onClick={() => setRutasVisibles((v) => !v)}
          >
            <Layers />
          </BotonMapa>
          {userLocation ? (
            <BotonMapa label="Centrar en mi ubicación" onClick={centrarEnMi}>
              <LocateFixed />
            </BotonMapa>
          ) : null}
        </div>
      ) : null}

      {children}
    </div>
  )
}

function BotonMapa({
  label,
  onClick,
  pressed,
  className,
  children,
}: {
  label: string
  onClick: () => void
  pressed?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'grid size-10 place-items-center rounded-control bg-surface-raised text-fg shadow-elev transition-colors duration-(--dur-fast) hover:bg-surface-2 aria-[pressed=false]:text-fg-subtle dark:border dark:border-border [&_svg]:size-[18px] [&_svg]:stroke-[1.75]',
        className
      )}
    >
      <span aria-hidden="true" className="inline-flex">
        {children}
      </span>
    </button>
  )
}

function ChipMapa({
  activo,
  onClick,
  etiqueta,
  children,
}: {
  activo: boolean
  onClick: () => void
  etiqueta?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      aria-label={etiqueta}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold tnum shadow-card transition-colors duration-(--dur-fast)',
        activo
          ? 'border-surface-inverse bg-surface-inverse text-fg-inverse'
          : 'border-border-strong bg-surface-raised text-fg hover:bg-surface-2'
      )}
    >
      {children}
    </button>
  )
}
