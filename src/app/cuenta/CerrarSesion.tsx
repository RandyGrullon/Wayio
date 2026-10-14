'use client'

import { useTransition } from 'react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { signOut } from '@/lib/auth/actions'

/**
 * Cerrar sesión (contrato de auth y plataforma): ANTES de la server action
 * signOut se borran los datos sin conexión de este navegador
 * (clearOfflineData) y se reinicia la analítica (resetAnalytics). signOut
 * redirige a «/».
 */
export function CerrarSesion() {
  const [saliendo, startSalida] = useTransition()

  const cerrar = () =>
    startSalida(async () => {
      try {
        const { clearOfflineData } = await import('@/lib/offline/cleanup')
        await clearOfflineData()
      } catch {
        // Limpieza best-effort: nunca bloquea el cierre de sesión.
      }
      try {
        const { resetAnalytics } = await import('@/lib/analytics/events')
        resetAnalytics()
      } catch {
        // La analítica nunca bloquea el cierre de sesión.
      }
      await signOut()
    })

  return (
    <Button
      variant="outline"
      size="md"
      icon={<LogOut />}
      onClick={cerrar}
      loading={saliendo}
      loadingText="Cerrando sesión…"
    >
      Cerrar sesión
    </Button>
  )
}
