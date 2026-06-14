'use client'

import { useTransition } from 'react'
import type { ActionResult } from '@/types/admin'

export function ToggleAction({
  enabled,
  action,
}: {
  enabled: boolean
  action: (enabled: boolean) => Promise<ActionResult>
}) {
  const [pending, start] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await action(!enabled)
        })
      }
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        enabled ? 'bg-green-500' : 'bg-gray-300'
      }`}
      aria-pressed={enabled}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
