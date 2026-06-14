'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SearchBar({
  basePath,
  placeholder,
  defaultValue,
}: {
  basePath: string
  placeholder: string
  defaultValue?: string | undefined
}) {
  const router = useRouter()
  const [v, setV] = useState(defaultValue ?? '')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = v.trim()
      ? `${basePath}?search=${encodeURIComponent(v.trim())}`
      : basePath
    router.push(q)
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        className="w-64 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      />
      <button className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">
        Buscar
      </button>
    </form>
  )
}
