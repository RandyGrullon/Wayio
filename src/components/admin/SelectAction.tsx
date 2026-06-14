'use client'

import { useTransition, useState } from 'react'
import type { ActionResult } from '@/types/admin'

export function SelectAction({
  value,
  options,
  action,
}: {
  value: string
  options: { value: string; label: string }[]
  action: (value: string) => Promise<ActionResult>
}) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  return (
    <span className="inline-flex items-center gap-1">
      <select
        defaultValue={value}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value
          setErr(null)
          start(async () => {
            const res = await action(v)
            if (!res.ok) setErr(res.error)
          })
        }}
        className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {err ? (
        <span className="text-xs text-red-500" title={err}>
          ⚠
        </span>
      ) : null}
    </span>
  )
}
