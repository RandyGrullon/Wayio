export type { OfflineStorage, OfflineTripRecord } from './types'
export {
  getOfflineStorage,
  saveTrip,
  loadTrip,
  getTripRecord,
  removeTrip,
  listTripIds,
  saveActiveTripId,
  loadActiveTripId,
} from './storage'
