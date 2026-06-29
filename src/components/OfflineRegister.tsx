'use client'

import { useEffect, useState } from 'react'

/**
 * Registers the offline service worker and renders a small offline indicator.
 *
 * Safe by design:
 *  - No-op when service workers are unsupported or during SSR (all
 *    `navigator`/`window` access is guarded and runs only inside effects).
 *  - Registration failures are swallowed so they can never break the app.
 */
export default function OfflineRegister() {
  const [isOffline, setIsOffline] = useState(false)

  // Register the service worker once on mount — production only.
  // In development the dev server serves un-hashed JS chunks, so a cache-first
  // worker would pin stale bundles across edits; there we unregister instead.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => void r.unregister())
      })
      return
    }
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* offline support is best-effort; never surface a failure */
    })
  }, [])

  // Track connectivity for the indicator.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => setIsOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 border-t border-border bg-surface px-4 py-2 text-center text-sm text-fg-muted shadow-lg"
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full bg-fg-subtle"
      />
      Sin conexión — mostrando tu itinerario guardado
    </div>
  )
}
