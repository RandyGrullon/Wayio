'use client'

import Link from 'next/link'
import { LogIn } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useUser } from '@/hooks/useUser'

export function SiteHeader() {
  const { user } = useUser()

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          aria-label="Inicio"
          className="transition-opacity hover:opacity-80"
        >
          <Logo />
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Link
              href="/trip"
              className="glass inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-fg transition-colors hover:text-brand-600"
            >
              Mis viajes
            </Link>
          ) : (
            <Link
              href="/login"
              className="glass inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-fg transition-colors hover:text-brand-600"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Iniciar sesión</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
