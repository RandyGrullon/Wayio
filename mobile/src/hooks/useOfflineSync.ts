import { useState, useEffect, useCallback, useRef } from 'react'
import { AppState } from 'react-native'
import * as Network from 'expo-network'
import { syncPendingChanges } from '../lib/offline/sync'
import { loadPendingSync } from '../lib/offline/storage'

export interface UseOfflineSyncReturn {
  isOnline: boolean
  /** Cambios de estado aún sin subir. */
  pendingCount: number
  /** true mientras se sincroniza. */
  syncing: boolean
  /** Última sincronización correcta (cola vacía), o null. */
  lastSyncedAt: Date | null
  syncNow: () => Promise<void>
}

const INTERVALO_MS = 30_000

/**
 * Conexión y cola de sincronización del modo en vivo. Escucha los cambios de
 * red, reintenta cada 30 s y al volver a la app, y nunca lanza errores.
 */
export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const montado = useRef(true)
  const enCurso = useRef(false)

  const refreshPendingCount = useCallback(async (): Promise<number> => {
    try {
      const pending = await loadPendingSync()
      if (montado.current) setPendingCount(pending.length)
      return pending.length
    } catch {
      return 0
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (enCurso.current) return
    enCurso.current = true
    if (montado.current) setSyncing(true)
    try {
      await syncPendingChanges()
    } catch {
      // Se reintenta en el siguiente ciclo.
    } finally {
      enCurso.current = false
      const quedan = await refreshPendingCount()
      if (montado.current) {
        setSyncing(false)
        if (quedan === 0) setLastSyncedAt(new Date())
      }
    }
  }, [refreshPendingCount])

  const revisar = useCallback(async () => {
    let online = false
    try {
      const estado = await Network.getNetworkStateAsync()
      online =
        estado.isConnected === true && estado.isInternetReachable !== false
    } catch {
      online = false
    }
    if (!montado.current) return
    setIsOnline(online)
    if (online) await syncNow()
    else await refreshPendingCount()
  }, [refreshPendingCount, syncNow])

  useEffect(() => {
    montado.current = true
    const primera = setTimeout(() => void revisar(), 0)
    const intervalo = setInterval(() => void revisar(), INTERVALO_MS)
    const red = Network.addNetworkStateListener((estado) => {
      const online =
        estado.isConnected === true && estado.isInternetReachable !== false
      setIsOnline(online)
      if (online) void syncNow()
    })
    const app = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void revisar()
    })
    return () => {
      montado.current = false
      clearTimeout(primera)
      clearInterval(intervalo)
      red.remove()
      app.remove()
    }
  }, [revisar, syncNow])

  return { isOnline, pendingCount, syncing, lastSyncedAt, syncNow }
}
