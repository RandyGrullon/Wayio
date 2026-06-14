'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createAnnouncement } from '@/lib/admin/actions'
import type { Platform } from '@/types/admin'

type Level = 'info' | 'warning' | 'critical'

export function AnnouncementForm() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [level, setLevel] = useState<Level>('info')
  const [platform, setPlatform] = useState<Platform>('all')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await createAnnouncement({ title, body, level, platform })
      if (res.ok) {
        setTitle('')
        setBody('')
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-gray-200 bg-white p-4"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título del anuncio"
        required
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Mensaje que verán los usuarios en web y/o mobile…"
        required
        rows={2}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as Level)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="info">Info</option>
          <option value="warning">Aviso</option>
          <option value="critical">Crítico</option>
        </select>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="all">Todas las plataformas</option>
          <option value="web">Solo web</option>
          <option value="mobile">Solo mobile</option>
        </select>
        <button
          disabled={pending}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? 'Publicando…' : 'Publicar anuncio'}
        </button>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </form>
  )
}
