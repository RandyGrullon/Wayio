import { useState, useEffect, useCallback } from 'react'
import * as Location from 'expo-location'
import type { UserLocation } from '../types/geofencing'

interface UseLocationReturn {
  location: UserLocation | null
  error: string | null
  isTracking: boolean
  requestPermissions: () => Promise<boolean>
}

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [subscription, setSubscription] =
    useState<Location.LocationSubscription | null>(null)

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const { status: fg } = await Location.requestForegroundPermissionsAsync()
    if (fg !== 'granted') {
      setError('Permiso de ubicación denegado')
      return false
    }
    return true
  }, [])

  useEffect(() => {
    let mounted = true

    void (async () => {
      const granted = await requestPermissions()
      if (!granted || !mounted) return

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 5,
        },
        (loc) => {
          if (!mounted) return
          setLocation({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            accuracy: loc.coords.accuracy ?? 0,
            timestamp: new Date(loc.timestamp),
          })
          setIsTracking(true)
        }
      )

      if (mounted) setSubscription(sub)
    })()

    return () => {
      mounted = false
      subscription?.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { location, error, isTracking, requestPermissions }
}
