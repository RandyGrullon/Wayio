import { StyleSheet, View } from 'react-native'
import MapboxGL from '@rnmapbox/maps'
import { GeofenceCircle } from '../components/GeofenceCircle'
import type { UserLocation } from '../types/geofencing'
import type { ActivityEvaluation } from '../types/activity'

MapboxGL.setAccessToken(process.env['EXPO_PUBLIC_MAPBOX_TOKEN'] ?? '')

interface Props {
  activities: ActivityEvaluation[]
  userLocation: UserLocation | null
  isCrucero: boolean | undefined
}

const DAY_COLORS = [
  '#2563EB',
  '#16A34A',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#0891B2',
  '#BE185D',
]

export function MapScreen({
  activities,
  userLocation,
  isCrucero,
}: Props): React.ReactElement {
  const centerLat = userLocation?.lat ?? activities[0]?.lat ?? 18.4742
  const centerLng = userLocation?.lng ?? activities[0]?.lng ?? -69.9312

  const routeCoords = activities.map((a) => [a.lng, a.lat] as [number, number])

  return (
    <View style={styles.container}>
      <MapboxGL.MapView style={styles.map} styleURL={MapboxGL.StyleURL.Street}>
        <MapboxGL.Camera
          centerCoordinate={[centerLng, centerLat]}
          zoomLevel={13}
          animationMode="flyTo"
          animationDuration={1000}
        />

        {userLocation && (
          <MapboxGL.PointAnnotation
            id="user-location"
            coordinate={[userLocation.lng, userLocation.lat]}
          >
            <View style={styles.userDot} />
          </MapboxGL.PointAnnotation>
        )}

        {routeCoords.length > 1 && (
          <MapboxGL.ShapeSource
            id="route"
            shape={{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: routeCoords,
              },
              properties: {},
            }}
          >
            <MapboxGL.LineLayer
              id="route-line"
              style={{
                lineColor: DAY_COLORS[0] ?? '#2563EB',
                lineWidth: isCrucero === true ? 4 : 2.5,
                ...(isCrucero === true ? { lineDasharray: [4, 3] } : {}),
                lineOpacity: 0.7,
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {activities.map((activity, i) => (
          <MapboxGL.ShapeSource
            key={activity.id}
            id={`activity-${activity.id}`}
            shape={{
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [activity.lng, activity.lat],
              },
              properties: {},
            }}
          >
            <GeofenceCircle activity={activity} index={i} />
          </MapboxGL.ShapeSource>
        ))}
      </MapboxGL.MapView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  userDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
})
