import type { ReactNode } from 'react'
import { Callout } from '@/components/ui/Callout'
import type { CalloutTone } from '@/components/ui/Callout'

/*
 * Piezas ligeras de las pantallas de auth, aparte de AuthShell para que los
 * formularios cliente no arrastren la postal ni el panel de marca. AuthShell
 * las re-exporta (el contrato las ubica allí).
 */

const TONO: Record<'error' | 'exito' | 'info', CalloutTone> = {
  error: 'danger',
  exito: 'success',
  info: 'info',
}

/**
 * Mensaje de estado (Callout del sistema). Los errores usan role="alert" (se
 * anuncian al momento); los avisos de éxito e info, role="status".
 */
export function Aviso({
  tipo,
  children,
  className,
  titulo,
  accion,
}: {
  tipo: 'error' | 'exito' | 'info'
  children: ReactNode
  className?: string
  /** Título opcional en negrita. */
  titulo?: string
  /** Acción opcional (Button variant="link" o un enlace). */
  accion?: ReactNode
}) {
  return (
    <Callout
      tone={TONO[tipo]}
      role={tipo === 'error' ? 'alert' : 'status'}
      className={className}
      {...(titulo ? { title: titulo } : {})}
      {...(accion ? { action: accion } : {})}
    >
      {children}
    </Callout>
  )
}

/**
 * H1 + subtítulo de las pantallas de auth. AuthShell lo pinta solo; los
 * formularios cuyo título cambia en el cliente (login ↔ registro) lo usan
 * directamente omitiendo `titulo` en AuthShell.
 */
export function AuthTitulo({
  titulo,
  subtitulo,
}: {
  titulo: string
  subtitulo?: string | undefined
}) {
  return (
    <>
      <h1 className="mt-10 font-display text-h1 text-fg">{titulo}</h1>
      {subtitulo ? (
        <p className="mt-2 text-body-s text-fg-muted">{subtitulo}</p>
      ) : null}
    </>
  )
}
