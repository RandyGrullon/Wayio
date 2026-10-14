'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { legible } from './etiquetas'
import { etiquetaSeccion } from './navegacion'

interface Miga {
  label: string
  href?: string
}

const DETALLE: Record<string, string> = {
  users: 'Detalle de usuario',
  trips: 'Detalle de viaje',
}

function migasDe(pathname: string): Miga[] {
  const [, seccion, detalle] = pathname.split('/').filter(Boolean)
  const migas: Miga[] = [{ label: 'Admin', href: '/admin' }]
  if (!seccion) {
    migas.push({ label: 'Panel' })
    return migas
  }
  const label = etiquetaSeccion(seccion) ?? legible(seccion)
  if (!detalle) {
    migas.push({ label })
    return migas
  }
  migas.push({ label, href: `/admin/${seccion}` })
  migas.push({ label: DETALLE[seccion] ?? 'Detalle' })
  return migas
}

/** Migas del topbar: Admin › Usuarios › Detalle de usuario. */
export function Migas({ className }: { className?: string }) {
  const pathname = usePathname()
  const migas = migasDe(pathname)
  return (
    <nav aria-label="Migas" className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-[14px]">
        {migas.map((miga, i) => {
          const ultima = i === migas.length - 1
          return (
            <li
              key={`${miga.label}-${i}`}
              className={cn(
                'flex min-w-0 items-center gap-1.5',
                // En móvil solo caben las dos últimas.
                i < migas.length - 2 && 'max-sm:hidden'
              )}
            >
              {i > 0 ? (
                <ChevronRight
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className={cn(
                    'size-3.5 shrink-0 text-fg-subtle',
                    i === migas.length - 2 && 'max-sm:hidden'
                  )}
                />
              ) : null}
              {miga.href && !ultima ? (
                <Link
                  href={miga.href}
                  className="truncate rounded-sm font-medium text-fg-muted transition-colors duration-(--dur-fast) hover:text-fg"
                >
                  {miga.label}
                </Link>
              ) : (
                <span
                  aria-current={ultima ? 'page' : undefined}
                  className="truncate font-semibold text-fg"
                >
                  {miga.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
