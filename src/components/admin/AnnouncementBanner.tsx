'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ConfigAnnouncement {
  id: string
  title: string
  body: string
  level: 'info' | 'warning' | 'critical'
}

const ESTILOS: Record<
  ConfigAnnouncement['level'],
  { clases: string; Icono: LucideIcon }
> = {
  info: { clases: 'bg-info-bg text-info-fg', Icono: Info },
  warning: { clases: 'bg-warning-bg text-warning-fg', Icono: AlertTriangle },
  critical: { clases: 'bg-danger-bg text-danger-fg', Icono: AlertCircle },
}

/** Descartes guardados por id (localStorage; tolera que esté bloqueado). */
const CLAVE_DESCARTES = 'wayio-anuncios-cerrados'

function leerDescartes(): string[] {
  try {
    const crudo = localStorage.getItem(CLAVE_DESCARTES)
    const lista: unknown = crudo ? JSON.parse(crudo) : []
    return Array.isArray(lista)
      ? lista.filter((v): v is string => typeof v === 'string')
      : []
  } catch {
    return []
  }
}

function guardarDescartes(ids: string[]): void {
  try {
    // Solo los últimos 50 para no crecer sin límite.
    localStorage.setItem(CLAVE_DESCARTES, JSON.stringify(ids.slice(-50)))
  } catch {
    // Almacenamiento bloqueado: se descarta solo en esta visita.
  }
}

/**
 * Muestra los anuncios activos (plataforma web) que el admin publica desde
 * /admin/announcements. Lee /api/config — el mismo endpoint que consume mobile.
 * Estilo §6.1: banda de 40 px con el color del nivel, icono, texto y cierre.
 * No se muestra en /admin.
 */
export function AnnouncementBanner() {
  const pathname = usePathname()
  const [items, setItems] = useState<ConfigAnnouncement[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    let vivo = true
    fetch('/api/config?platform=web')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { announcements?: ConfigAnnouncement[] } | null) => {
        if (!vivo) return
        setDismissed(leerDescartes())
        if (d?.announcements) setItems(d.announcements)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  if (pathname?.startsWith('/admin')) return null
  const visible = items.filter((i) => !dismissed.includes(i.id))
  if (visible.length === 0) return null

  const cerrar = (id: string) => {
    setDismissed((d) => {
      const nuevos = [...d, id]
      guardarDescartes(nuevos)
      return nuevos
    })
  }

  return (
    <div data-print="hide" className="flex flex-col">
      {visible.map((a) => {
        const { clases, Icono } = ESTILOS[a.level] ?? ESTILOS.info
        return (
          <div
            key={a.id}
            role={a.level === 'critical' ? 'alert' : 'status'}
            className={cn('text-[14px]', clases)}
          >
            <div className="mx-auto flex min-h-10 max-w-content items-center gap-2.5 py-1.5 pr-1.5 pl-4 md:pl-6 lg:pl-8">
              <Icono
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-[18px] shrink-0"
              />
              <p className="min-w-0 flex-1 leading-snug">
                <span className="font-semibold">{a.title}</span>
                {a.body ? <span> · {a.body}</span> : null}
              </p>
              <button
                type="button"
                onClick={() => cerrar(a.id)}
                aria-label="Cerrar anuncio"
                className="relative inline-grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-(--dur-fast) after:absolute after:-inset-1 hover:bg-fg/10"
              >
                <X
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-[18px]"
                />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
