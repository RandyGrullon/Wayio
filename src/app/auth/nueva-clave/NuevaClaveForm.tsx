'use client'

import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, CircleCheck } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Aviso } from '@/app/auth/_componentes/Aviso'
import { CampoClave } from '@/app/auth/_componentes/CampoClave'
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  RECUPERAR_PATH,
} from '@/lib/auth/constants'
import { updatePassword } from '@/lib/auth/actions'
import type { AuthErrorCode } from '@/lib/auth/types'

/** Formulario de contraseña nueva + confirmación. */
export function NuevaClaveForm() {
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [codigo, setCodigo] = useState<AuthErrorCode | null>(null)
  const [listo, setListo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const errorLocal =
    confirmacion.length > 0 && password !== confirmacion
      ? 'Las contraseñas no coinciden.'
      : undefined

  const guardar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setCodigo(null)
    if (password.length < PASSWORD_MIN) {
      setError(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`)
      return
    }
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.')
      return
    }
    startTransition(async () => {
      const r = await updatePassword(password, confirmacion)
      if (r.error) {
        setError(r.error)
        setCodigo(r.code ?? null)
        return
      }
      setPassword('')
      setConfirmacion('')
      setListo(r.message ?? 'Tu contraseña se actualizó.')
    })
  }

  if (listo) {
    return (
      <div aria-live="polite">
        <EmptyState
          icon={CircleCheck}
          title="Contraseña actualizada"
          headingLevel="h2"
          className="py-4"
          description={listo}
          action={
            <ButtonLink
              href="/"
              variant="primary"
              size="lg"
              iconEnd={<ArrowRight />}
            >
              Ir a Wayio
            </ButtonLink>
          }
        />
      </div>
    )
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4" noValidate>
      <CampoClave
        id="nueva-clave"
        label="Nueva contraseña"
        name="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        hint={`Mínimo ${PASSWORD_MIN} caracteres.`}
        required
      />
      <CampoClave
        id="nueva-clave-confirmacion"
        label="Repite la contraseña"
        name="confirmacion"
        autoComplete="new-password"
        value={confirmacion}
        onChange={(e) => setConfirmacion(e.target.value)}
        maxLength={PASSWORD_MAX}
        {...(errorLocal ? { error: errorLocal } : {})}
        required
      />
      {error ? (
        <Aviso
          tipo="error"
          {...(codigo === 'enlace'
            ? {
                accion: (
                  <ButtonLink href={RECUPERAR_PATH} variant="link">
                    Pedir un enlace nuevo
                  </ButtonLink>
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
        loading={isPending}
        loadingText="Guardando…"
      >
        Guardar contraseña
      </Button>
    </form>
  )
}
