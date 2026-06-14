'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Day } from '@/types/trip'
import type { Activity } from '@/types/activity'
import type { UserLocation } from '@/types/geofencing'
import { DAY_COLORS } from '@/constants/mapColors'
import { buildNavigationLinks } from '@/constants/affiliateLinks'

interface TripMapProps {
  dias: Day[]
  userLocation?: UserLocation
  actividadActiva?: Activity
  isCrucero?: boolean
  className?: string
}

// Estilo de mapa gratuito (OpenFreeMap): sin API key, sin tarjeta, sin registro
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

// Approximate a circle as a GeoJSON polygon
function makeCircleCoords(
  center: [number, number],
  radiusMeters: number
): [number, number][] {
  const points = 64
  const deg = radiusMeters / 111320
  const coords: [number, number][] = []
  for (let i = 0; i <= points; i++) {
    const angle = ((i % points) * 2 * Math.PI) / points
    coords.push([
      center[0] + deg * Math.sin(angle),
      center[1] + deg * Math.cos(angle),
    ])
  }
  return coords
}

export function TripMap({
  dias,
  userLocation,
  actividadActiva,
  isCrucero = false,
  className,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const gpsMarkerRef = useRef<maplibregl.Marker | null>(null)
  // day index → markers for that day
  const markersRef = useRef<Map<number, maplibregl.Marker[]>>(new Map())
  const [activeDayIdx, setActiveDayIdx] = useState<number | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // ¿Alguna actividad tiene coordenadas reales? Si no, no inicializamos el mapa
  // (centrarlo en un punto arbitrario engaña al usuario): mostramos un aviso.
  const hasAnyCoords = dias.some((d) =>
    d.actividades.some((a) => a.lat !== 0 || a.lng !== 0)
  )

  // ── Map init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const anyCoords = dias.some((d) =>
      d.actividades.some((a) => a.lat !== 0 || a.lng !== 0)
    )
    if (!anyCoords) return

    const firstAct = dias[0]?.actividades[0]
    const center: [number, number] =
      firstAct && (firstAct.lat !== 0 || firstAct.lng !== 0)
        ? [firstAct.lng, firstAct.lat]
        : [-69.9, 18.5]

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center,
      zoom: 12,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', () => {
      const bounds = new maplibregl.LngLatBounds()

      dias.forEach((day, dayIdx) => {
        const color = DAY_COLORS[dayIdx % DAY_COLORS.length] ?? '#2E75B6'
        const validActs = day.actividades.filter(
          (a) => a.lat !== 0 || a.lng !== 0
        )

        // Route line
        if (validActs.length >= 2) {
          const coords = validActs.map((a): [number, number] => [a.lng, a.lat])
          map.addSource(`route-${dayIdx}`, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords },
            },
          })
          map.addLayer({
            id: `route-${dayIdx}`,
            type: 'line',
            source: `route-${dayIdx}`,
            paint: {
              'line-color': color,
              'line-width': isCrucero ? 2 : 3,
              'line-opacity': 0.8,
              'line-dasharray': isCrucero ? [4, 3] : [2, 1],
            },
          })
        }

        // Activity markers
        const dayMarkers: maplibregl.Marker[] = []
        validActs.forEach((activity, actIdx) => {
          bounds.extend([activity.lng, activity.lat])

          const el = document.createElement('div')
          el.style.cssText = `
            width:28px;height:28px;border-radius:50%;
            background-color:${color};border:2px solid white;
            color:white;display:flex;align-items:center;
            justify-content:center;font-size:11px;font-weight:bold;
            cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,.35);
          `
          const isPort = isCrucero && activity.puertoCrucero
          if (isPort) {
            el.style.cssText = `
              width:32px;height:32px;border-radius:6px;
              background-color:#1e40af;border:2px solid white;
              color:white;display:flex;align-items:center;
              justify-content:center;font-size:16px;
              cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.45);
            `
            el.textContent = '⚓'
          } else {
            el.textContent = String(actIdx + 1)
          }

          const nav = buildNavigationLinks(activity.lat, activity.lng)
          const popup = new maplibregl.Popup({
            offset: 26,
            maxWidth: '230px',
          }).setHTML(
            `<div style="font-family:sans-serif;padding:4px 2px">
              <p style="font-weight:bold;margin:0 0 3px">${activity.nombre}</p>
              <p style="font-size:12px;color:#555;margin:0 0 2px">${activity.horaInicio} – ${activity.horaFin}</p>
              <p style="font-size:12px;margin:0 0 6px">${activity.direccion}</p>
              <p style="font-size:12px;margin:0 0 6px;color:#2E75B6">$${activity.precioEstimado}</p>
              <div style="display:flex;gap:4px;flex-wrap:wrap">
                <a href="${nav.google}" target="_blank"
                  style="font-size:11px;padding:2px 7px;background:#4285F4;color:white;border-radius:3px;text-decoration:none">
                  Google Maps
                </a>
                <a href="${nav.waze}" target="_blank"
                  style="font-size:11px;padding:2px 7px;background:#33CCFF;color:#000;border-radius:3px;text-decoration:none">
                  Waze
                </a>
                <a href="${nav.apple}" target="_blank"
                  style="font-size:11px;padding:2px 7px;background:#555;color:white;border-radius:3px;text-decoration:none">
                  Apple
                </a>
              </div>
            </div>`
          )

          dayMarkers.push(
            new maplibregl.Marker({ element: el })
              .setLngLat([activity.lng, activity.lat])
              .setPopup(popup)
              .addTo(map)
          )
        })
        markersRef.current.set(dayIdx, dayMarkers)
      })

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 14 })
      }
      setMapLoaded(true)
    })

    const markersSnap = markersRef.current
    return () => {
      markersSnap.forEach((ms) => ms.forEach((m) => m.remove()))
      markersSnap.clear()
      gpsMarkerRef.current?.remove()
      gpsMarkerRef.current = null
      map.remove()
      mapRef.current = null
      setMapLoaded(false)
    }
  }, [dias, isCrucero])

  // ── Day filter ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    dias.forEach((_, dayIdx) => {
      const visible = activeDayIdx === null || activeDayIdx === dayIdx
      const layerId = `route-${dayIdx}`
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(
          layerId,
          'visibility',
          visible ? 'visible' : 'none'
        )
      }
      markersRef.current.get(dayIdx)?.forEach((m) => {
        m.getElement().style.opacity = visible ? '1' : '0.2'
      })
    })
  }, [activeDayIdx, mapLoaded, dias])

  // ── GPS dot ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userLocation) return
    if (!gpsMarkerRef.current) {
      const el = document.createElement('div')
      el.style.cssText = `
        width:16px;height:16px;background:#3B82F6;border-radius:50%;
        border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,.3);
      `
      gpsMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map)
    } else {
      gpsMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat])
    }
  }, [userLocation])

  // ── Geofencing circle ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const cleanup = () => {
      if (map.getLayer('gf-fill')) map.removeLayer('gf-fill')
      if (map.getLayer('gf-border')) map.removeLayer('gf-border')
      if (map.getSource('gf')) map.removeSource('gf')
    }
    cleanup()

    if (!actividadActiva) return

    const coords = makeCircleCoords(
      [actividadActiva.lng, actividadActiva.lat],
      actividadActiva.radioGeofencingMetros
    )

    map.addSource('gf', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [coords] },
      },
    })
    map.addLayer({
      id: 'gf-fill',
      type: 'fill',
      source: 'gf',
      paint: { 'fill-color': '#3B82F6', 'fill-opacity': 0.12 },
    })
    map.addLayer({
      id: 'gf-border',
      type: 'line',
      source: 'gf',
      paint: { 'line-color': '#3B82F6', 'line-width': 2, 'line-opacity': 0.7 },
    })

    return cleanup
  }, [actividadActiva, mapLoaded])

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${className ?? 'h-full w-full'}`}
    >
      {/* Sin coordenadas: aviso en vez de un mapa centrado en un punto al azar */}
      {!hasAnyCoords ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-surface-muted px-6 text-center">
          <span className="text-3xl">🗺️</span>
          <p className="text-sm font-semibold text-fg">
            Ubicaciones aún no disponibles
          </p>
          <p className="max-w-xs text-xs text-fg-subtle">
            Estamos afinando las coordenadas de las actividades. Aparecerán en
            el mapa en unos segundos.
          </p>
        </div>
      ) : null}

      {/* Day selector overlay */}
      <div
        className="absolute left-2 top-2 z-10 flex flex-wrap gap-1"
        style={{ display: hasAnyCoords ? undefined : 'none' }}
      >
        <button
          onClick={() => setActiveDayIdx(null)}
          className="rounded px-2 py-1 text-xs font-semibold text-white shadow"
          style={{
            backgroundColor: '#1f2937',
            opacity: activeDayIdx === null ? 1 : 0.65,
          }}
        >
          Todos
        </button>
        {dias.map((day, idx) => (
          <button
            key={day.numero}
            onClick={() => setActiveDayIdx(idx === activeDayIdx ? null : idx)}
            className="rounded px-2 py-1 text-xs font-semibold text-white shadow transition-opacity"
            style={{
              backgroundColor: DAY_COLORS[idx % DAY_COLORS.length] ?? '#2E75B6',
              opacity: activeDayIdx === null || activeDayIdx === idx ? 1 : 0.55,
            }}
          >
            D{day.numero}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
