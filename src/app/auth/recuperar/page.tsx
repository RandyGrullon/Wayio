import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell, Aviso } from '@/app/auth/_componentes/AuthShell'
import { mensajeDeErrorUrl } from '@/lib/auth/mensajes'
import { RecuperarForm } from './RecuperarForm'

export const metadata: Metadata = {
  title: 'Recuperar contraseña',
  robots: { index: false, follow: false },
}

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const error = typeof params['error'] === 'string' ? params['error'] : null
  const mensajeError = mensajeDeErrorUrl(error)

  return (
    <AuthShell
      titulo="¿Olvidaste tu contraseña?"
      subtitulo="Escribe el email de tu cuenta y te enviamos un enlace para crear una nueva."
      semilla="recuperar"
    >
      {mensajeError ? (
        <Aviso tipo="error" className="mb-6">
          {error === 'enlace'
            ? 'Ese enlace ya caducó o ya se usó. Pide uno nuevo aquí abajo.'
            : mensajeError}
        </Aviso>
      ) : null}
      <RecuperarForm />
      <p className="mt-8 text-center text-body-s text-fg-muted">
        ¿Te acordaste?{' '}
        <Link
          href="/login"
          className="rounded-sm font-semibold text-accent underline decoration-1 underline-offset-[3px] hover:text-accent-hover"
        >
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthShell>
  )
}
