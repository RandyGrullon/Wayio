import type { Metadata } from 'next'
import { AuthShell, Aviso } from '@/app/auth/_componentes/AuthShell'
import { ButtonLink } from '@/components/ui/Button'
import { tipoOtpValido } from '@/lib/auth/constants'
import { deepLinkApp, tokenHashValido } from '@/lib/auth/redirect'
import { AbrirAppCliente } from './AbrirAppCliente'

export const metadata: Metadata = {
  title: 'Abrir Wayio',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

/**
 * Puente para enlaces de email pedidos desde la app móvil: intenta abrir la
 * app con el token (la app inicia sesión con verifyOtp). Si la app no está en
 * este dispositivo, se puede continuar en la web con el mismo enlace.
 */
export default async function AbrirAppPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const rawToken =
    typeof params['token_hash'] === 'string' ? params['token_hash'] : null
  const tipo = tipoOtpValido(
    typeof params['type'] === 'string' ? params['type'] : null
  )

  if (!tokenHashValido(rawToken) || !tipo) {
    return (
      <AuthShell titulo="Enlace no válido" semilla="abrir-app">
        <Aviso tipo="error" className="mb-6">
          Este enlace no es válido o está incompleto. Pide uno nuevo desde la
          app.
        </Aviso>
        <ButtonLink href="/login" variant="outline" size="lg" fullWidth>
          Iniciar sesión en la web
        </ButtonLink>
      </AuthShell>
    )
  }

  const deepLink = deepLinkApp(rawToken, tipo)
  const web = new URLSearchParams({
    token_hash: rawToken,
    type: tipo,
    next: '/',
  })

  return (
    <AuthShell
      titulo="Abriendo Wayio…"
      subtitulo="Si la app no se abre sola, toca el botón."
      semilla="abrir-app"
    >
      <AbrirAppCliente
        deepLink={deepLink}
        urlWeb={`/auth/confirm?${web.toString()}`}
      />
    </AuthShell>
  )
}
