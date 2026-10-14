'use client'

import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect, useRef } from 'react'
import { useUser } from '@/hooks/useUser'
import {
  identifyUser,
  initPostHog,
  posthog,
  resetAnalytics,
} from '@/lib/analytics/client'

/**
 * Une la sesión de Supabase con la persona de PostHog: identify al tener
 * usuario y reset cuando la sesión desaparece (cierre de sesión), para que los
 * eventos del servidor (distinctId = user.id) y los del navegador coincidan.
 */
function IdentidadAnalitica() {
  const { user, loading } = useUser()
  const anterior = useRef<string | null>(null)

  useEffect(() => {
    if (loading) return
    const id = user?.id ?? null
    if (id) {
      if (id !== anterior.current) identifyUser(id)
    } else if (anterior.current) {
      // Sin conexión, Supabase puede "perder" la sesión temporalmente: solo
      // olvidamos la identidad si hay red (es un cierre de sesión real).
      const online = typeof navigator === 'undefined' || navigator.onLine
      if (online) resetAnalytics()
    }
    anterior.current = id
  }, [user, loading])

  return null
}

/**
 * Proveedor de analítica. La inicialización real ocurre en
 * src/instrumentation-client.ts (antes de hidratar); aquí se repite por si
 * acaso (es idempotente). Las páginas vistas se registran solas en cada cambio
 * de ruta (capture_pageview: 'history_change').
 */
function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog()
  }, [])

  return (
    <PHProvider client={posthog}>
      <IdentidadAnalitica />
      {children}
    </PHProvider>
  )
}

export default PostHogProvider
