import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { CopiarTexto } from './CopiarTexto'

/**
 * Cabecera de ficha (docs/DISENO.md §6.12): volver, h1, ID en Geist Mono con
 * copiar y el estado a la derecha.
 */
export function DetalleCabecera({
  volver,
  kicker,
  titulo,
  subtitulo,
  id,
  estado,
}: {
  volver: { href: string; label: string }
  kicker?: string
  titulo: ReactNode
  subtitulo?: ReactNode
  id: string
  estado?: ReactNode
}) {
  return (
    <div>
      <ButtonLink
        href={volver.href}
        variant="link"
        size="sm"
        icon={<ArrowLeft />}
        className="no-underline hover:underline"
      >
        {volver.label}
      </ButtonLink>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {kicker ? <p className="kicker mb-1.5">{kicker}</p> : null}
          <h1 className="font-display text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] break-words text-fg">
            {titulo}
          </h1>
          {subtitulo ? (
            <div className="mt-1.5 text-body-s text-fg-muted">{subtitulo}</div>
          ) : null}
          <p className="mt-2 flex min-w-0 items-center gap-1.5 text-caption text-fg-subtle">
            <span className="kicker text-fg-subtle">ID</span>
            <CopiarTexto valor={id} />
          </p>
        </div>
        {estado ? (
          <div className="flex flex-wrap items-center gap-2">{estado}</div>
        ) : null}
      </div>
    </div>
  )
}
