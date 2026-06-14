'use client'

import { Suspense, useState, useTransition } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
} from '@/lib/auth/actions'

type AuthMode = 'login' | 'signup'

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/'
  const authError = searchParams.get('error')

  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleEmailAuth = (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError(null)
    startTransition(async () => {
      if (mode === 'login') {
        const result = await signInWithEmail(email, password)
        if (result.error) setFieldError(result.error)
      } else {
        const result = await signUpWithEmail(email, password, nombre)
        if (result.error) setFieldError(result.error)
        else setSuccess(true)
      }
    })
  }

  const handleGoogle = () => {
    startTransition(async () => {
      await signInWithGoogle(redirectTo)
    })
  }

  return (
    <main className="bg-aurora flex min-h-screen items-center justify-center px-4 py-10">
      <div className="animate-rise glass w-full max-w-md rounded-3xl p-8 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.4)]">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="mb-4 inline-flex items-center justify-center"
            aria-label="Inicio"
          >
            <Logo />
          </Link>
          <h1 className="text-xl font-extrabold tracking-tight text-fg">
            {mode === 'login' ? '¡Bienvenido de vuelta!' : 'Crea tu cuenta'}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            {mode === 'login'
              ? 'Inicia sesión para guardar tus viajes'
              : 'Empieza gratis, sin tarjeta'}
          </p>
        </div>

        {authError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            Error de autenticación. Intenta de nuevo.
          </div>
        ) : null}

        {success ? (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
            Cuenta creada. Revisa tu email para confirmar.
          </div>
        ) : null}

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={isPending}
          className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-border-strong bg-surface px-4 py-3 text-sm font-semibold text-fg transition-colors hover:bg-surface-muted disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M47.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h13.2c-.6 3-2.4 5.6-5 7.3v6h8.1c4.7-4.4 7.2-10.8 7.2-17.6z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-8.1-6c-2.1 1.4-4.8 2.2-7.7 2.2-5.9 0-10.9-4-12.7-9.3H3v6.2C7 42.9 15 48 24 48z"
            />
            <path
              fill="#FBBC05"
              d="M11.3 29.1c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4V14H3c-1.6 3.1-2.5 6.6-2.5 10.3S1.4 31.5 3 34.6l8.3-5.5z"
            />
            <path
              fill="#EA4335"
              d="M24 9.5c3.3 0 6.3 1.1 8.6 3.4l6.4-6.4C35.9 2.9 30.5.5 24 .5 15 .5 7 5.6 3 14l8.3 5.5C13.1 14 18 9.5 24 9.5z"
            />
          </svg>
          Continuar con Google
        </button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs text-fg-subtle">
            <span className="bg-surface px-2">o con email</span>
          </div>
        </div>

        <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
          {mode === 'signup' ? (
            <input
              type="text"
              placeholder="Nombre completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="h-11 rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            />
          ) : null}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="h-11 rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
          />

          {fieldError ? (
            <p className="text-xs font-medium text-red-600">{fieldError}</p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="grad-brand mt-1 rounded-xl py-3 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(20,184,166,0.6)] transition-all hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-60"
          >
            {isPending
              ? 'Cargando...'
              : mode === 'login'
                ? 'Iniciar sesión'
                : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-fg-muted">
          {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setFieldError(null)
            }}
            className="font-semibold text-brand-600 hover:underline"
          >
            {mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
