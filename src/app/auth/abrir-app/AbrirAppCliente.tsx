'use client'

import { useEffect, useRef } from 'react'
import { ArrowRight, Smartphone } from 'lucide-react'
import { buttonClasses } from '@/components/ui/Button'

/**
 * Intenta abrir la app una sola vez al cargar y deja dos salidas manuales:
 * abrir la app o terminar en la web (sin la app instalada).
 */
export function AbrirAppCliente({
  deepLink,
  urlWeb,
}: {
  deepLink: string
  urlWeb: string
}) {
  const intentado = useRef(false)

  useEffect(() => {
    if (intentado.current) return
    intentado.current = true
    window.location.href = deepLink
  }, [deepLink])

  // <a> nativos: ni el esquema wayio:// ni /auth/confirm (route handler)
  // deben pasar por el router del cliente.
  return (
    <div className="flex flex-col gap-3">
      <a
        href={deepLink}
        className={buttonClasses({
          variant: 'primary',
          size: 'lg',
          fullWidth: true,
        })}
      >
        <Smartphone aria-hidden="true" strokeWidth={1.75} />
        Abrir la app
      </a>
      <a
        href={urlWeb}
        className={buttonClasses({
          variant: 'outline',
          size: 'lg',
          fullWidth: true,
        })}
      >
        Continuar en la web
        <ArrowRight aria-hidden="true" strokeWidth={1.75} />
      </a>
      <p className="mt-2 text-center text-caption text-fg-subtle">
        ¿No tienes la app en este dispositivo? Continúa en la web. El enlace
        solo funciona una vez: úsalo en la app o en la web.
      </p>
    </div>
  )
}
