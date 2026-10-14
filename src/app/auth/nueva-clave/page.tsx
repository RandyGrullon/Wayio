import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell, Aviso } from '@/app/auth/_componentes/AuthShell'
import { ButtonLink } from '@/components/ui/Button'
import { PASSWORD_MIN, RECUPERAR_PATH } from '@/lib/auth/constants'
import { usuarioEnRecuperacion } from '@/lib/auth/server'
import { NuevaClaveForm } from './NuevaClaveForm'

export const metadata: Metadata = {
  title: 'Nueva contraseña',
  robots: { index: false, follow: false },
}

/**
 * Elegir contraseña nueva. Solo funciona con la sesión que crea el enlace de
 * recuperación (o de invitación) en este navegador; si no, ofrece pedir otro.
 */
export default async function NuevaClavePage() {
  const userId = await usuarioEnRecuperacion()

  if (!userId) {
    return (
      <AuthShell titulo="Este enlace ya no sirve" semilla="nueva-clave">
        <Aviso tipo="error" className="mb-6">
          El enlace para cambiar tu contraseña caducó o ya se usó. Pide uno
          nuevo y ábrelo en este mismo navegador.
        </Aviso>
        <ButtonLink href={RECUPERAR_PATH} variant="primary" size="lg" fullWidth>
          Pedir un enlace nuevo
        </ButtonLink>
        <p className="mt-8 text-center text-body-s text-fg-muted">
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

  return (
    <AuthShell
      titulo="Elige tu nueva contraseña"
      subtitulo={`Usa al menos ${PASSWORD_MIN} caracteres. Mejor si es una frase que recuerdes.`}
      semilla="nueva-clave"
    >
      <NuevaClaveForm />
    </AuthShell>
  )
}
