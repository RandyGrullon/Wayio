'use client'

import { useTransition, useState } from 'react'
import type { ActionResult } from '@/types/admin'

export function ActionButton({
  action,
  label,
  confirm,
  variant = 'ghost',
}: {
  action: () => Promise<ActionResult>
  label: string
  confirm?: string | undefined
  variant?: 'ghost' | 'danger' | 'primary'
}) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const onClick = () => {
    if (confirm && !window.confirm(confirm)) return
    setErr(null)
    start(async () => {
      const res = await action()
      if (!res.ok) setErr(res.error)
    })
  }

  const styles =
    variant === 'danger'
      ? 'text-red-600 hover:bg-red-50'
      : variant === 'primary'
        ? 'bg-blue-600 text-white hover:bg-blue-700'
        : 'text-gray-600 hover:bg-gray-100'

  return (
    <span className="inline-flex items-center gap-1">
      <button
        onClick={onClick}
        disabled={pending}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${styles}`}
      >
        {pending ? '…' : label}
      </button>
      {err ? (
        <span className="text-xs text-red-500" title={err}>
          ⚠
        </span>
      ) : null}
    </span>
  )
}
