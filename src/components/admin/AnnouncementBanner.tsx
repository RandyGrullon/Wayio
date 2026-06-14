'use client'

import { useEffect, useState } from 'react'

interface ConfigAnnouncement {
  id: string
  title: string
  body: string
  level: 'info' | 'warning' | 'critical'
}

const STYLES: Record<ConfigAnnouncement['level'], string> = {
  info: 'bg-blue-50 text-blue-800 border-blue-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  critical: 'bg-red-50 text-red-800 border-red-200',
}

/**
 * Muestra los anuncios activos (plataforma web) que el admin publica desde
 * /admin/announcements. Lee /api/config — el mismo endpoint que consume mobile.
 */
export function AnnouncementBanner() {
  const [items, setItems] = useState<ConfigAnnouncement[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/config?platform=web')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { announcements?: ConfigAnnouncement[] } | null) => {
        if (d?.announcements) setItems(d.announcements)
      })
      .catch(() => {})
  }, [])

  const visible = items.filter((i) => !dismissed.includes(i.id))
  if (visible.length === 0) return null

  return (
    <div className="flex flex-col">
      {visible.map((a) => (
        <div
          key={a.id}
          className={`flex items-start justify-between gap-3 border-b px-4 py-2 text-sm ${STYLES[a.level]}`}
        >
          <p>
            <span className="font-semibold">{a.title}</span> — {a.body}
          </p>
          <button
            onClick={() => setDismissed((d) => [...d, a.id])}
            className="shrink-0 opacity-60 hover:opacity-100"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
