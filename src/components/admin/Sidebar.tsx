'use client'

import { useId, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, LogOut } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Badge } from '@/components/ui/Badge'
import { signOut } from '@/lib/auth/actions'
import { cn } from '@/lib/utils/cn'
import { NAV_ADMIN, itemActivo } from './navegacion'

const ITEM =
  'relative flex h-10 w-full items-center gap-3 rounded-control px-3 text-left text-[14px] font-medium ' +
  'transition-colors duration-(--dur-fast) ease-papel focus-visible:outline-offset-[-2px] ' +
  '[&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:stroke-[1.75]'

/**
 * Contenido del sidebar del panel (docs/DISENO.md §6.12): wordmark de 22 px
 * con «Admin», grupos con kicker y pie con el email, «Volver a la app» y
 * «Cerrar sesión». Lo usan el aside de escritorio y el drawer móvil.
 */
export function Sidebar({
  email,
  onNavegar,
}: {
  email: string
  /** Se llama al pulsar un enlace (el drawer se cierra). */
  onNavegar?: () => void
}) {
  const pathname = usePathname()
  const uid = useId()
  const [saliendo, startSalida] = useTransition()
  // next/link no admite onClick={undefined} con exactOptionalPropertyTypes.
  const alNavegar = onNavegar ? { onClick: onNavegar } : {}

  const cerrarSesion = () =>
    startSalida(async () => {
      // Antes del server action: borrar los datos offline y la identidad de
      // la analítica de este dispositivo (contrato de plataforma).
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
        // La analítica nunca rompe el cierre de sesión.
      }
      await signOut()
    })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-5">
        <Link
          href="/admin"
          aria-label="Wayio, panel de administración"
          {...alNavegar}
          className="-m-1 inline-flex rounded-sm p-1"
        >
          <Logo className="h-[22px] w-auto" />
        </Link>
        <Badge variant="brand">Admin</Badge>
      </div>

      <nav
        aria-label="Secciones del panel"
        className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-6"
      >
        {NAV_ADMIN.map((grupo, i) => (
          <div key={grupo.id} className={cn(i > 0 && 'mt-6')}>
            <p id={`${uid}-${grupo.id}`} className="kicker px-3 pb-2">
              {grupo.titulo}
            </p>
            <ul aria-labelledby={`${uid}-${grupo.id}`} className="space-y-0.5">
              {grupo.items.map((item) => {
                const activo = itemActivo(pathname, item.href)
                const Icono = item.icono
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={activo ? 'page' : undefined}
                      {...alNavegar}
                      className={cn(
                        ITEM,
                        activo
                          ? 'bg-surface-2 text-fg before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary'
                          : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
                      )}
                    >
                      <Icono aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-border p-3">
        <p
          className="truncate px-3 pt-1 pb-2 text-caption text-fg-muted"
          title={email}
        >
          <span className="sr-only">Sesión iniciada como </span>
          {email}
        </p>
        <Link
          href="/"
          {...alNavegar}
          className={cn(ITEM, 'text-fg-muted hover:bg-surface-2 hover:text-fg')}
        >
          <ArrowLeft aria-hidden="true" />
          Volver a la app
        </Link>
        <button
          type="button"
          onClick={cerrarSesion}
          disabled={saliendo}
          aria-busy={saliendo || undefined}
          className={cn(
            ITEM,
            'text-fg-muted hover:bg-surface-2 hover:text-fg disabled:cursor-wait disabled:opacity-60'
          )}
        >
          <LogOut aria-hidden="true" />
          {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </div>
    </div>
  )
}
