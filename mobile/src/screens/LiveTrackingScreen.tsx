import { useMemo } from 'react'
import { TripScreen } from './TripScreen'
import { useNavigation } from '../navigation/NavigationContext'
import { planningTripToLiveTrip } from '../lib/trips/convert'
import type { PlanningTrip } from '../types/planning'

/**
 * Adapts a planning trip into the live-tracking engine's model and renders the
 * existing GPS/geofencing/alerts TripScreen.
 */
export function LiveTrackingScreen({
  trip,
}: {
  trip: PlanningTrip
}): React.ReactElement {
  const { goBack } = useNavigation()
  const liveTrip = useMemo(() => planningTripToLiveTrip(trip), [trip])
  return <TripScreen trip={liveTrip} onExit={goBack} />
}
