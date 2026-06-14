'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const THEME_EVENT = 'wayio-theme-change'

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback)
  return () => window.removeEventListener(THEME_EVENT, callback)
}

function getSnapshot() {
  return document.documentElement.classList.contains('dark')
}

// Server (and the first hydration pass) always renders the "light" icon so the
// markup matches; useSyncExternalStore then reconciles to the real value.
function getServerSnapshot() {
  return false
}

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('wayio-theme', next ? 'dark' : 'light')
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Cambiar tema"
      className={cn(
        'glass inline-flex h-10 w-10 items-center justify-center rounded-full text-fg-muted transition-colors hover:text-fg',
        className
      )}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
