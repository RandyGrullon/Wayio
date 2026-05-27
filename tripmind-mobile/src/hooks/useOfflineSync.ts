import { useState, useEffect, useCallback } from 'react'
import * as Network from 'expo-network'
import { syncPendingChanges } from '../lib/offline/sync'
import { loadPendingSync } from '../lib/offline/storage'

export interface UseOfflineSyncReturn {
  isOnline: boolean
  pendingCount: number
  syncNow: () => Promise<void>
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  const refreshPendingCount = useCallback(async () => {
    const pending = await loadPendingSync()
    setPendingCount(pending.length)
  }, [])

  const syncNow = useCallback(async () => {
    await syncPendingChanges()
    await refreshPendingCount()
  }, [refreshPendingCount])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>

    void (async () => {
      const state = await Network.getNetworkStateAsync()
      setIsOnline(!!state.isConnected)
      await refreshPendingCount()

      interval = setInterval(async () => {
        const netState = await Network.getNetworkStateAsync()
        const online = !!netState.isConnected
        setIsOnline(online)
        if (online) await syncNow()
        else await refreshPendingCount()
      }, 30000)
    })()

    return () => clearInterval(interval)
  }, [syncNow, refreshPendingCount])

  return { isOnline, pendingCount, syncNow }
}
