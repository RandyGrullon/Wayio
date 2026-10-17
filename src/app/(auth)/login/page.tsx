import type { Metadata } from 'next'
import { AuthShell } from '@/app/auth/_componentes/AuthShell'
import { mensajeDeErrorUrl } from '@/lib/auth/mensajes'
import { destinoSeguro } from '@/lib/auth/redirect'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { LoginForm } from './LoginForm'
import type { AuthMode } from './LoginForm'

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description:
    'Entra en Wayio para trazar tus viajes con IA, guardarlos, compartirlos y planificar en grupo.',
  robots: { index: false, follow: true },
}

type Params = Record<string, string | string[] | undefined>

function texto(v: string | string[] | undefined): string | null {
  return typeof v === 'string' ? v : null
}

/**
 * Login y registro (docs/DISENO.md §6.9). La lógica vive en LoginForm; aquí
 * se leen y validan los parámetros de la URL en el servidor:
 * - ?redirect=/ruta (p. ej. el enlace de un grupo), validado con destinoSeguro.
 * - ?error=enlace|oauth|config|auth, traducido con mensajeDeErrorUrl.
 * - ?modo=registro abre directamente en «Crear cuenta».
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  const params = await searchParams
  const redirectTo = destinoSeguro(texto(params['redirect']))
  const errorUrl = mensajeDeErrorUrl(texto(params['error']))
  const modoInicial: AuthMode =
    texto(params['modo']) === 'registro' ? 'signup' : 'login'

  // El H1 lo pinta LoginForm: cambia al alternar entre entrar y registrarse.
  return (
    <AuthShell>
      <LoginForm
        redirectTo={redirectTo}
        errorUrl={errorUrl}
        modoInicial={modoInicial}
        demo={!isSupabaseConfigured()}
      />
    </AuthShell>
  )
}
