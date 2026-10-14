import type { ReactNode } from 'react'
import { FileText } from 'lucide-react'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { Callout } from '@/components/ui/Callout'
import { formatFecha } from '@/lib/utils/formatters'

export interface SeccionLegal {
  id: string
  titulo: string
}

/**
 * Marco de las páginas legales y de contacto (privacidad, términos,
 * contacto): portada con kicker y H1, aviso de BORRADOR (lo debe revisar un
 * abogado antes de publicarse como definitivo), índice y prosa a 68 ch.
 */
export function PaginaLegal({
  kicker,
  titulo,
  intro,
  actualizado,
  secciones,
  borrador = true,
  children,
}: {
  kicker: string
  titulo: ReactNode
  intro: ReactNode
  /** 'YYYY-MM-DD' de la última revisión del texto. */
  actualizado: string
  /** Índice de la página (ids de los <h2>). */
  secciones?: readonly SeccionLegal[]
  borrador?: boolean
  children: ReactNode
}) {
  return (
    <>
      <SiteHeader />
      <main id="contenido" className="flex-1">
        <header className="reticula border-b border-border">
          <div className="mx-auto max-w-content px-4 pt-14 pb-12 md:px-6 lg:px-8 lg:pt-20">
            <p className="kicker kicker-filete">{kicker}</p>
            <h1 className="mt-4 max-w-[20ch] font-display text-display-l text-fg">
              {titulo}
            </h1>
            <div className="mt-5 max-w-[60ch] text-lead text-fg-muted">
              {intro}
            </div>
            <p className="mt-6 text-caption text-fg-subtle tnum">
              Última actualización:{' '}
              {formatFecha(actualizado, { anio: true, diaSemana: false })}
            </p>
          </div>
        </header>

        <div className="mx-auto grid max-w-content gap-12 px-4 py-14 md:px-6 lg:grid-cols-12 lg:px-8 lg:py-20">
          {secciones && secciones.length > 0 ? (
            <nav aria-labelledby="indice-legal" className="lg:col-span-3">
              <div className="lg:sticky lg:top-24">
                <h2 id="indice-legal" className="kicker">
                  En esta página
                </h2>
                <ol className="mt-4 flex flex-col gap-2 text-body-s">
                  {secciones.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="rounded-sm text-fg-muted underline-offset-[3px] hover:text-fg hover:underline"
                      >
                        {s.titulo}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </nav>
          ) : null}

          <div
            className={
              secciones && secciones.length > 0
                ? 'min-w-0 lg:col-span-9'
                : 'min-w-0 lg:col-span-8'
            }
          >
            {borrador ? (
              <Callout
                tone="warning"
                icon={FileText}
                title="Borrador pendiente de revisión legal"
                className="mb-10 max-w-prose"
              >
                Este texto explica con honestidad cómo funciona Wayio hoy, pero
                todavía no lo ha revisado un abogado. El responsable de Wayio
                debe validarlo antes de darlo por definitivo.
              </Callout>
            ) : null}
            <div className="max-w-prose text-body text-fg [&_a]:rounded-sm [&_a]:text-accent [&_a]:underline [&_a]:decoration-1 [&_a]:underline-offset-[3px] [&_a:hover]:text-accent-hover [&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:font-display [&_h2]:text-h2 [&_h2]:text-fg [&_h2:first-child]:mt-0 [&_h3]:mt-8 [&_h3]:text-title [&_h3]:text-fg [&_li]:mt-2 [&_p]:mt-4 [&_p]:text-fg-muted [&_strong]:font-semibold [&_strong]:text-fg [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-fg-muted">
              {children}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
