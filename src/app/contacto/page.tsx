import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  CreditCard,
  KeyRound,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PaginaLegal } from '@/app/privacidad/PaginaLegal'
import { ButtonLink } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { RECUPERAR_PATH } from '@/lib/auth/constants'
import { getBaseUrl } from '@/lib/utils/baseUrl'

export const metadata: Metadata = {
  title: 'Contacto',
  description:
    'Escríbenos para dudas sobre tu cuenta, tus pagos, tus datos o para contarnos cómo mejorar Wayio.',
  alternates: { canonical: `${getBaseUrl()}/contacto` },
}

/** Email público de contacto (NEXT_PUBLIC_CONTACT_EMAIL), si es válido. */
function emailDeContacto(): string | null {
  const v = process.env['NEXT_PUBLIC_CONTACT_EMAIL']?.trim()
  return v && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) ? v : null
}

const ATAJOS: {
  icon: LucideIcon
  titulo: string
  texto: string
  href: string
  enlace: string
}[] = [
  {
    icon: KeyRound,
    titulo: '¿No puedes entrar?',
    texto: 'Pide un enlace para crear una contraseña nueva.',
    href: RECUPERAR_PATH,
    enlace: 'Recuperar contraseña',
  },
  {
    icon: CreditCard,
    titulo: 'Pagos y suscripción',
    texto: 'Cambia de plan, actualiza tu tarjeta o cancela desde Tu cuenta.',
    href: '/cuenta',
    enlace: 'Ir a Tu cuenta',
  },
  {
    icon: ShieldCheck,
    titulo: 'Tus datos',
    texto: 'Qué guardamos y cómo pedir una copia o que los borremos.',
    href: '/privacidad#derechos',
    enlace: 'Leer la política de privacidad',
  },
]

/** Contacto: email público (si está configurado) y atajos de ayuda. */
export default function ContactoPage() {
  const email = emailDeContacto()

  return (
    <PaginaLegal
      kicker="Ayuda"
      titulo={
        <>
          Hablemos de tu <em className="italic">viaje</em>
        </>
      }
      intro="Dudas sobre tu cuenta, tus pagos o tus datos, ideas para mejorar Wayio o un error que encontraste: aquí nos encuentras."
      actualizado="2026-10-08"
      borrador={false}
    >
      <h2 id="escribenos">Escríbenos</h2>
      {email ? (
        <>
          <p>
            Te responderemos lo antes posible desde República Dominicana. Si es
            sobre un viaje guardado, cuéntanos el destino y las fechas para
            encontrarlo antes. Escríbenos desde el email de tu cuenta.
          </p>
          <div className="mt-6">
            <ButtonLink
              href={`mailto:${email}`}
              variant="tinta"
              size="lg"
              icon={<Mail />}
            >
              {email}
            </ButtonLink>
          </div>
        </>
      ) : (
        <Callout
          tone="info"
          title="El correo de contacto llega muy pronto"
          className="mt-4"
        >
          Todavía estamos preparando el canal de atención. Mientras tanto, los
          atajos de abajo resuelven lo más habitual.
        </Callout>
      )}

      <h2 id="atajos">Antes de escribir</h2>
      <ul className="mt-6! grid list-none! gap-4 pl-0!">
        {ATAJOS.map(({ icon: Icono, titulo, texto, href, enlace }) => (
          <li
            key={href}
            className="mt-0! flex gap-4 rounded-card border border-border bg-surface p-5"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-fg">
              <Icono aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="mt-0! text-title text-fg!">{titulo}</p>
              <p className="mt-1! text-body-s">{texto}</p>
              <Link
                href={href}
                className="mt-2 inline-flex items-center gap-1 text-[15px] font-medium"
              >
                {enlace}
                <ArrowRight
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </PaginaLegal>
  )
}
