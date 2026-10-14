import { useMemo } from 'react'
import MapboxGL from '@rnmapbox/maps'
import { anilloGeodesico } from '../lib/geofencing/geodesia'
import type { ActivityEvaluation } from '../types/activity'

interface Props {
  activities: ActivityEvaluation[]
  /** Color de cada día (índice 0-based → token del tema). */
  colorDeDia: (diaIndex: number) => string
  /** Día resaltado (los demás se atenúan); null = todos iguales. */
  diaActivo: number | null
}

/**
 * Geocercas con su radio REAL en metros: polígonos geodésicos (no círculos en
 * píxeles), así escalan con el zoom y muestran exactamente dónde se detecta
 * la llegada. Una sola fuente para todas las actividades.
 */
export function GeofenceCircles({
  activities,
  colorDeDia,
  diaActivo,
}: Props): React.ReactElement | null {
  const shape = useMemo<GeoJSON.FeatureCollection<GeoJSON.Polygon>>(
    () => ({
      type: 'FeatureCollection',
      features: activities
        .filter(
          (a) => (a.lat !== 0 || a.lng !== 0) && a.radioGeofencingMetros > 0
        )
        .map((a) => ({
          type: 'Feature',
          id: a.id,
          properties: {
            color: colorDeDia(a.diaIndex),
            activo: diaActivo === null || a.diaIndex === diaActivo ? 1 : 0,
            hecho: a.estado === 'completada' || a.estado === 'perdida' ? 1 : 0,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              anilloGeodesico(a.lat, a.lng, a.radioGeofencingMetros),
            ],
          },
        })),
    }),
    [activities, colorDeDia, diaActivo]
  )

  if (shape.features.length === 0) return null

  return (
    <MapboxGL.ShapeSource id="geocercas" shape={shape}>
      <MapboxGL.FillLayer
        id="geocercas-relleno"
        style={{
          fillColor: ['get', 'color'],
          fillOpacity: [
            'case',
            ['==', ['get', 'activo'], 1],
            ['case', ['==', ['get', 'hecho'], 1], 0.06, 0.14],
            0.04,
          ],
        }}
      />
      <MapboxGL.LineLayer
        id="geocercas-borde"
        style={{
          lineColor: ['get', 'color'],
          lineWidth: 1.5,
          lineOpacity: ['case', ['==', ['get', 'activo'], 1], 0.7, 0.25],
          lineDasharray: [2, 2],
        }}
      />
    </MapboxGL.ShapeSource>
  )
}
