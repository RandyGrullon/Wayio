'use client'

import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { ArrowRight, MailCheck } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { AuthTitulo, Aviso } from '@/app/auth/_componentes/Aviso'
import { CampoClave } from '@/app/auth/_componentes/CampoClave'
import {
  resendConfirmation,
  sendMagicLink,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '@/lib/auth/actions'
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  RECUPERAR_PATH,
} from '@/lib/auth/constants'
import type { AuthResult } from '@/lib/auth/types'
import { GoogleG } from './GoogleG'

export type AuthMode = 'login' | 'signup'

type Accion = 'email' | 'google' | 'magia' | 'reenviar'

export interface LoginFormProps {
  /** ?redirect ya validado con destinoSeguro() en el servidor. */
  redirectTo: string
  /** Mensaje traducido del ?error= de la URL (o null). */
  errorUrl: string | null
  modoInicial: AuthMode
  /** Sin Supabase configurado: el formulario se muestra deshabilitado. */
  demo: boolean
}

const ENLACE_LEGAL =
  'text-accent underline decoration-1 underline-offset-[3px] hover:text-accent-hover'

export function LoginForm({
  redirectTo,
  errorUrl,
  modoInicial,
  demo,
}: LoginFormProps) {
  const [mode, setMode] = useState<AuthMode>(modoInicial)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [puedeReenviar, setPuedeReenviar] = useState(false)
  const [accion, setAccion] = useState<Accion | null>(null)
  const [isPending, startTransition] = useTransition()

  const ocupado = isPending || demo

  // Si la action redirige (login correcto), no vuelve un resultado útil.
  const aplicar = (r: AuthResult | undefined): void => {
    if (!r) return
    if (r.error) {
      setError(r.error)
      setPuedeReenviar(r.code === 'email_no_confirmado')
      return
    }
    if (r.message) setAviso(r.message)
  }

  const limpiarMensajes = (): void => {
    setError(null)
    setAviso(null)
    setPuedeReenviar(false)
  }

  const ejecutar = (tipo: Accion, tarea: () => Promise<AuthResult>) => {
    setAccion(tipo)
    startTransition(async () => {
      try {
        aplicar(await tarea())
      } finally {
        setAccion(null)
      }
    })
  }

  const handleEmailAuth = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (demo) return
    limpiarMensajes()
    if (mode === 'signup' && password.length < PASSWORD_MIN) {
      setError(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`)
      return
    }
    ejecutar('email', () =>
      mode === 'login'
        ? signInWithEmail(email, password, redirectTo)
        : signUpWithEmail(email, password, nombre, redirectTo)
    )
  }

  const handleGoogle = () => {
    if (demo) return
    limpiarMensajes()
    ejecutar('google', () => signInWithGoogle(redirectTo))
  }

  const handleMagicLink = () => {
    if (demo) return
    limpiarMensajes()
    if (!email.trim()) {
      setError('Escribe tu email y te enviamos un enlace para entrar.')
      return
    }
    ejecutar('magia', () => sendMagicLink(email, redirectTo))
  }

  const handleReenviar = () => {
    limpiarMensajes()
    ejecutar('reenviar', () => resendConfirmation(email, redirectTo))
  }

  const cambiarModo = () => {
    setMode(mode === 'login' ? 'signup' : 'login')
    limpiarMensajes()
  }

  const titulo =
    mode === 'login' ? (
      <AuthTitulo
        titulo="Bienvenido de vuelta"
        subtitulo="Inicia sesión para guardar y compartir tus viajes."
      />
    ) : (
      <AuthTitulo
        titulo="Crea tu cuenta"
        subtitulo="Empieza gratis, sin tarjeta."
      />
    )

  // Registro correcto: «Revisa tu email» (se limpia al cambiar de modo).
  if (mode === 'signup' && aviso) {
    return (
      <>
        {titulo}
        <div aria-live="polite" className="mt-6">
          <EmptyState
            icon={MailCheck}
            title="Revisa tu email"
            headingLevel="h2"
            className="py-6"
            description={aviso}
            action={
              <Button variant="outline" size="lg" onClick={cambiarModo}>
                Volver a iniciar sesión
              </Button>
            }
          />
        </div>
      </>
    )
  }

  return (
    <>
      {titulo}
      <div className="mt-8">
        {demo ? (
          <Aviso
            tipo="info"
            className="mb-6"
            titulo="Las cuentas todavía no están disponibles"
            accion={
              <ButtonLink
                href="/planificar"
                variant="link"
                iconEnd={<ArrowRight />}
              >
                Planificar sin cuenta
              </ButtonLink>
            }
          >
            Puedes trazar un viaje ahora mismo; para guardarlo hará falta
            iniciar sesión cuando las cuentas estén listas.
          </Aviso>
        ) : null}

        {errorUrl && !error && !aviso ? (
          <Aviso tipo="error" className="mb-6">
            {errorUrl}
          </Aviso>
        ) : null}

        {aviso ? (
          <Aviso tipo="exito" className="mb-6">
            {aviso}
          </Aviso>
        ) : null}

        <Button
          variant="outline"
          size="lg"
          fullWidth
          icon={<GoogleG />}
          onClick={handleGoogle}
          disabled={ocupado}
          loading={accion === 'google'}
          loadingText="Abriendo Google…"
        >
          Continuar con Google
        </Button>

        <div className="my-6 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-caption text-fg-subtle">o con tu email</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmailAuth} noValidate>
          <fieldset disabled={demo} className="flex flex-col gap-4">
            <legend className="sr-only">
              {mode === 'login'
                ? 'Iniciar sesión con email'
                : 'Crear cuenta con email'}
            </legend>
            {mode === 'signup' ? (
              <Input
                id="login-nombre"
                label="Nombre"
                type="text"
                name="nombre"
                autoComplete="name"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={80}
                required
              />
            ) : null}
            <Input
              id="login-email"
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div>
              <CampoClave
                id="login-password"
                label="Contraseña"
                name="password"
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={PASSWORD_MAX}
                disabled={demo}
                {...(mode === 'signup'
                  ? {
                      minLength: PASSWORD_MIN,
                      hint: `Mínimo ${PASSWORD_MIN} caracteres. Mejor si es una frase que recuerdes.`,
                    }
                  : {})}
                required
              />
              {mode === 'login' ? (
                <p className="mt-2 text-right">
                  <Link
                    href={RECUPERAR_PATH}
                    className={`rounded-sm text-[14px] font-medium ${ENLACE_LEGAL}`}
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </p>
              ) : null}
            </div>

            {error ? (
              <Aviso
                tipo="error"
                {...(puedeReenviar
                  ? {
                      accion: (
                        <Button
                          variant="link"
                          onClick={handleReenviar}
                          disabled={isPending}
                          loading={accion === 'reenviar'}
                          loadingText="Reenviando…"
                        >
                          Reenviar el correo de confirmación
                        </Button>
                      ),
                    }
                  : {})}
              >
                {error}
              </Aviso>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={ocupado}
              loading={accion === 'email'}
              loadingText={
                mode === 'login' ? 'Entrando…' : 'Creando tu cuenta…'
              }
              className="mt-1"
            >
              {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </Button>

            {mode === 'login' ? (
              <Button
                variant="ghost"
                size="md"
                fullWidth
                onClick={handleMagicLink}
                disabled={ocupado}
                loading={accion === 'magia'}
                loadingText="Enviando el enlace…"
              >
                Prefiero recibir un enlace por email
              </Button>
            ) : null}
          </fieldset>
        </form>

        <p className="mt-8 text-center text-body-s text-fg-muted">
          {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button
            type="button"
            onClick={cambiarModo}
            className={`rounded-sm font-semibold ${ENLACE_LEGAL}`}
          >
            {mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
        </p>

        <p className="mt-6 text-center text-caption text-fg-subtle">
          Al continuar aceptas los{' '}
          <Link href="/terminos" className={`rounded-sm ${ENLACE_LEGAL}`}>
            Términos
          </Link>{' '}
          y la{' '}
          <Link href="/privacidad" className={`rounded-sm ${ENLACE_LEGAL}`}>
            Política de privacidad
          </Link>
          .
        </p>
      </div>
    </>
  )
}
