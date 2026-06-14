'use client'

import { useEffect, useRef } from 'react'
import { PricingCards } from './PricingCards'

interface PaywallModalProps {
  open: boolean
  triggerMessage: string
  onClose: () => void
}

export function PaywallModal({
  open,
  triggerMessage,
  onClose,
}: PaywallModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className="m-auto max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl p-0 shadow-2xl backdrop:bg-black/60"
      onClose={onClose}
    >
      <div className="p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Desbloquea Wayio Pro
            </h2>
            {triggerMessage && (
              <p className="mt-1 text-sm text-indigo-700 font-medium">
                {triggerMessage}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <PricingCards />
      </div>
    </dialog>
  )
}
