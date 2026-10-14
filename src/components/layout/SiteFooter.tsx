import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { getTopDestinos } from '@/lib/seo/destinos'
import { cn } from '@/lib/utils/cn'

/**
 * Pie «contraportada» (docs/DISENO.md §5.12): tinta en claro y noche-900 en
 * oscuro, wordmark de 64 px, columnas Producto / Destinos / Ayuda y legal
 * (acordeón en móvil) y barra final en mono con las coordenadas de SDQ.
 */

interface EnlacePie {
  label: string
  href: string
}

interface ColumnaPie {
  titulo: string
  enlaces: EnlacePie[]
}

const PRODUCTO: EnlacePie[] = [
  { label: 'Planificar viaje', href: '/planificar' },
  { label: 'Cómo funciona', href: '/#como-funciona' },
  { label: 'Viajes en grupo', href: '/#grupo' },
  { label: 'Planes y precios', href: '/precios' },
  { label: 'Mis viajes', href: '/viajes' },
]

const AYUDA: EnlacePie[] = [
  { label: 'Privacidad', href: '/privacidad' },
  { label: 'Términos', href: '/terminos' },
  { label: 'Contacto', href: '/contacto' },
]

export interface SiteFooterProps {
  /** Destinos de la columna (por defecto, el top 10 SEO). */
  destinos?: readonly { slug: string; nombre: string }[]
  className?: string
}

export function SiteFooter({ destinos, className }: SiteFooterProps) {
  const top = (destinos ?? getTopDestinos()).slice(0, 10)
  const columnas: ColumnaPie[] = [
    { titulo: 'Producto', enlaces: PRODUCTO },
    {
      titulo: 'Destinos',
      enlaces: top.map((d) => ({ label: d.nombre, href: `/viaje/${d.slug}` })),
    },
    { titulo: 'Ayuda y legal', enlaces: AYUDA },
  ]
  const anio = new Date().getFullYear()

  return (
    <footer
      data-print="hide"
      className={cn(
        'bg-surface-inverse py-16 text-fg-inverse md:py-24 [&_:focus-visible]:outline-ring-inverse',
        'dark:border-t dark:border-border dark:bg-noche-900 dark:text-fg dark:[&_:focus-visible]:outline-ring',
        className
      )}
    >
      <div className="mx-auto max-w-content px-4 md:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Link
              href="/"
              aria-label="Wayio, inicio"
              className="inline-flex rounded-sm"
            >
              <Logo tone="inverso" className="h-16 w-auto" />
            </Link>
            <p className="mt-5 max-w-[30ch] text-body-s text-tinta-200">
              Traza tu viaje · Vive el camino
            </p>
          </div>

          {/* Desktop: columnas */}
          <nav
            aria-label="Pie de página"
            className="hidden gap-8 md:grid md:grid-cols-3 lg:col-span-8"
          >
            {columnas.map((c) => (
              <div key={c.titulo}>
                <h2 className="kicker text-tinta-300">{c.titulo}</h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {c.enlaces.map((e) => (
                    <li key={e.href}>
                      <Link
                        href={e.href}
                        className="rounded-sm text-[15px] text-tinta-200 transition-colors duration-(--dur-fast) hover:text-papel-50 hover:underline hover:underline-offset-[3px] dark:hover:text-fg"
                      >
                        {e.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* Móvil: acordeón */}
          <nav aria-label="Pie de página (móvil)" className="md:hidden">
            {columnas.map((c) => (
              <details
                key={c.titulo}
                className="group border-b border-tinta-800 dark:border-border"
              >
                <summary className="flex h-12 cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
                  <span className="kicker text-tinta-300">{c.titulo}</span>
                  <ChevronDown
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-[18px] text-tinta-300 transition-transform duration-(--dur-medium) group-open:rotate-180"
                  />
                </summary>
                <ul className="flex flex-col gap-1 pb-4">
                  {c.enlaces.map((e) => (
                    <li key={e.href}>
                      <Link
                        href={e.href}
                        className="flex h-10 items-center rounded-sm text-[15px] text-tinta-200"
                      >
                        {e.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </nav>
        </div>

        <p className="mt-16 border-t border-tinta-800 pt-6 font-mono text-[12px] text-tinta-300 dark:border-border">
          © {anio} Wayio · Hecho en República Dominicana · 18.4861° N 69.9312° O
        </p>
      </div>
    </footer>
  )
}

export default SiteFooter
