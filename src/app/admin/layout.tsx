import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AdminShell } from '@/components/admin/AdminShell'
import { PanelNoDisponible } from '@/components/admin/PanelNoDisponible'
import { exigirAdmin } from './_lib/acceso'

// El panel siempre se renderiza en runtime (usa auth + service role)
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  // Un title de texto en este layout cortaría la plantilla de la raíz para
  // las secciones hijas: se repite aquí para obtener «Usuarios · Admin | Wayio».
  title: { default: 'Admin', template: '%s | Wayio' },
  robots: { index: false, follow: false },
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  // Redirige a /login o a / si no hay sesión de admin. Cada página vuelve a
  // comprobarlo (los layouts y las páginas se renderizan en paralelo).
  const sesion = await exigirAdmin()
  if (!sesion) return <PanelNoDisponible />

  return (
    <AdminShell email={sesion.email} userId={sesion.userId} demo={sesion.demo}>
      {children}
    </AdminShell>
  )
}
