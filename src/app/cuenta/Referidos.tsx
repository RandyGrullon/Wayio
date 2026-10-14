'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Check, Copy } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { DUR, EASE } from '@/components/ui/motion'
import { formatNumero } from '@/lib/utils/formatters'

type EstadoCodigo =
  | { tipo: 'cargando' }
  | { tipo: 'ok'; code: string; conversions: number }
  | { tipo: 'error'; mensaje: string }

const CODIGO_RE = /^[A-Za-z0-9_-]{4,32}$/

async function json(res: Response): Promise<Record<string, unknown>> {
  try {
    const b = (await res.json()) as unknown
    return typeof b === 'object' && b !== null
      ? (b as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

/**
 * Invitaciones: tu código (GET /api/referrals → { code, conversions }) con
 * copiar, y canjear el de otra persona (POST /api/referrals { code } →
 * { ok, mensaje } | { ok: false, error, code }).
 */
export function Referidos() {
  const { success, error: toastError } = useToast()
  const [estado, setEstado] = useState<EstadoCodigo>({ tipo: 'cargando' })
  const [copiado, setCopiado] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{
    ok: boolean
    texto: string
  } | null>(null)
  const [errorCampo, setErrorCampo] = useState<string | undefined>(undefined)

  useEffect(() => {
    let vivo = true
    fetch('/api/referrals')
      .then(async (res) => {
        const body = await json(res)
        if (!vivo) return
        const code = typeof body['code'] === 'string' ? body['code'] : null
        if (res.ok && code) {
          setEstado({
            tipo: 'ok',
            code,
            conversions:
              typeof body['conversions'] === 'number' ? body['conversions'] : 0,
          })
          return
        }
        setEstado({
          tipo: 'error',
          mensaje:
            typeof body['error'] === 'string'
              ? body['error']
              : 'Tu código de invitación no está disponible ahora mismo.',
        })
      })
      .catch(() => {
        if (vivo)
          setEstado({
            tipo: 'error',
            mensaje:
              'No pudimos cargar tu código. Revisa tu conexión e inténtalo más tarde.',
          })
      })
    return () => {
      vivo = false
    }
  }, [])

  async function copiar(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiado(true)
      success('Código copiado')
      window.setTimeout(() => setCopiado(false), 1600)
    } catch {
      toastError('No pudimos copiar el código. Cópialo a mano.')
    }
  }

  async function canjear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setResultado(null)
    const limpio = codigo.trim()
    if (!CODIGO_RE.test(limpio)) {
      setErrorCampo('Escribe un código válido: de 4 a 32 letras o números.')
      return
    }
    setErrorCampo(undefined)
    setEnviando(true)
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: limpio }),
      })
      const body = await json(res)
      if (res.ok && body['ok'] === true) {
        setResultado({
          ok: true,
          texto:
            typeof body['mensaje'] === 'string'
              ? body['mensaje']
              : 'Código de invitación aplicado.',
        })
        setCodigo('')
      } else {
        setResultado({
          ok: false,
          texto:
            typeof body['error'] === 'string'
              ? body['error']
              : 'No pudimos aplicar el código. Inténtalo más tarde.',
        })
      }
    } catch {
      setResultado({
        ok: false,
        texto: 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.',
      })
    }
    setEnviando(false)
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-title text-fg">Tu código</h3>
        <p className="mt-1 text-body-s text-fg-muted">
          Compártelo con quien quieras invitar a Wayio.
        </p>
        <div className="mt-4" aria-live="polite">
          {estado.tipo === 'cargando' ? (
            <Skeleton className="h-control-lg w-64 rounded-control" />
          ) : estado.tipo === 'error' ? (
            <Callout tone="warning">{estado.mensaje}</Callout>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex h-control-lg items-center rounded-control border border-dashed border-border-strong bg-surface-2 px-4 font-mono text-[18px] tracking-[0.12em] text-fg">
                {estado.code}
              </span>
              <IconButton
                label={copiado ? 'Código copiado' : 'Copiar código'}
                variant="outline"
                size="icon-lg"
                onClick={() => void copiar(estado.code)}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <m.span
                    key={copiado ? 'ok' : 'copiar'}
                    className="inline-flex"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: DUR.fast, ease: EASE.papel }}
                  >
                    {copiado ? <Check /> : <Copy />}
                  </m.span>
                </AnimatePresence>
              </IconButton>
              <p className="w-full text-caption text-fg-muted tnum">
                {estado.conversions === 1
                  ? '1 persona se unió con tu código.'
                  : `${formatNumero(estado.conversions)} personas se unieron con tu código.`}
              </p>
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => void canjear(e)}
        noValidate
        className="border-t border-border pt-6"
      >
        <h3 className="text-title text-fg">¿Te invitó alguien?</h3>
        <p className="mt-1 text-body-s text-fg-muted">
          Escribe su código. Solo se puede usar una vez y en cuentas nuevas.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
          <Input
            id="cuenta-codigo-invitacion"
            label="Código de invitación"
            name="codigo"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={32}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            error={errorCampo}
            containerClassName="sm:flex-1"
            className="font-mono uppercase"
          />
          <Button
            type="submit"
            variant="outline"
            size="lg"
            loading={enviando}
            loadingText="Aplicando…"
            className="sm:mt-6"
          >
            Aplicar código
          </Button>
        </div>
        {resultado ? (
          <Callout tone={resultado.ok ? 'success' : 'danger'} className="mt-4">
            {resultado.texto}
          </Callout>
        ) : null}
      </form>
    </div>
  )
}
