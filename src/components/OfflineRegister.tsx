'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { clearOfflineData, syncOfflineOwner } from '@/lib/offline'

/**
 * Registra el service worker y muestra un aviso discreto sin conexión.
 *
 * - Solo en producción: en desarrollo el servidor sirve JS sin hash y un SW
 *   dejaría bundles viejos pegados, así que ahí se desregistra.
 * - Vigila la sesión para proteger los datos offline: si se cierra sesión los
 *   borra, y si entra otra persona borra los de la anterior.
 * - Seguro por diseño: sin `navigator`/`window` en SSR y sin lanzar nunca.
 * - En /trip/* no pinta la barra: esa pantalla tiene su propio aviso y debe
 *   haber uno solo (docs/DISENO.md §6.6). El registro sigue en todas las rutas.
 */
export default function OfflineRegister() {
  const [isOffline, setIsOffline] = useState(false)
  const enViaje = usePathname()?.startsWith('/trip/') ?? false

  // Registro del service worker (una vez al montar).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          regs.forEach((r) => void r.unregister())
        })
        .catch(() => {
          /* best effort */
        })
      return
    }
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* el modo offline es best-effort: nunca mostramos un fallo */
    })
  }, [])

  // Datos offline ligados a la sesión.
  useEffect(() => {
    if (!isSupabaseConfigured()) return
    let cancelar: (() => void) | null = null
    try {
      const supabase = createClient()
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        // Solo SIGNED_OUT es un cierre de sesión seguro: una sesión "vacía" al
        // arrancar sin red no lo es, y borraría los viajes guardados offline.
        if (event === 'SIGNED_OUT') {
          void clearOfflineData()
          return
        }
        const userId = session?.user?.id
        if (userId) void syncOfflineOwner(userId)
      })
      cancelar = () => subscription.unsubscribe()
    } catch {
      /* sin Supabase en el cliente: nada que vigilar */
    }
    return () => cancelar?.()
  }, [])

  // Estado de la conexión para el aviso.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => setIsOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!isOffline || enViaje) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 border-t border-border bg-surface px-4 py-2 text-center text-sm text-fg-muted shadow-lg"
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full bg-fg-subtle"
      />
      Sin conexión. Puedes seguir viendo los viajes que ya abriste en este
      dispositivo.
    </div>
  )
}
