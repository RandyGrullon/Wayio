'use client'

import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Aviso } from '@/app/auth/_componentes/Aviso'
import { requestPasswordReset } from '@/lib/auth/actions'

/** Formulario de "¿Olvidaste tu contraseña?": pide el email y envía el enlace. */
export function RecuperarForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const r = await requestPasswordReset(email)
      if (r.error) {
        setError(r.error)
        return
      }
      setEnviado(r.message ?? 'Revisa tu bandeja de entrada.')
    })
  }

  if (enviado) {
    return (
      <div aria-live="polite">
        <EmptyState
          icon={MailCheck}
          title="Revisa tu email"
          headingLevel="h2"
          className="py-4"
          description={enviado}
          action={
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setEnviado(null)
                setEmail('')
              }}
            >
              Usar otro email
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <Input
        id="recuperar-email"
        label="Email de tu cuenta"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder="tu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={isPending}
        loadingText="Enviando el enlace…"
      >
        Enviar enlace
      </Button>
    </form>
  )
}
