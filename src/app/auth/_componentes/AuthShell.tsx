import Link from 'next/link'
import type { ReactNode } from 'react'
import { Logo } from '@/components/brand/Logo'
import { Postal, PostalArte } from '@/components/brand/Postal'
import { AuthTitulo } from './Aviso'
import { IsotipoTrazado } from './IsotipoTrazado'

export { Aviso, AuthTitulo } from './Aviso'

/**
 * Marco común de las pantallas de autenticación (login, recuperar, nueva
 * contraseña, abrir la app). docs/DISENO.md §6.9:
 *
 * - Desktop: split 7/5. A la izquierda, papel con retícula, el isotipo que
 *   se traza una vez, la cita en Newsreader y una postal con sello. A la
 *   derecha, una columna de 400 px con el wordmark, el H1 y el formulario.
 * - Móvil: solo la columna, con una banda de postal de 120 px arriba.
 */
export function AuthShell({
  titulo,
  subtitulo,
  children,
  semilla = 'login',
}: {
  /** H1 de la pantalla. Si se omite, los hijos pintan su <AuthTitulo />. */
  titulo?: string
  subtitulo?: string
  children: ReactNode
  /** Semilla de la postal (cambia el dibujo por pantalla). */
  semilla?: string
}) {
  return (
    <main
      id="contenido"
      className="flex min-h-dvh flex-1 flex-col bg-bg lg:grid lg:grid-cols-12"
    >
      {/* Panel de marca (desktop) */}
      <aside className="reticula relative hidden overflow-hidden border-r border-border bg-surface-2 lg:sticky lg:top-0 lg:col-span-7 lg:flex lg:h-dvh lg:min-h-[640px] lg:flex-col lg:justify-between lg:gap-8 lg:px-12 lg:py-10 xl:px-16">
        <IsotipoTrazado className="size-14 shrink-0" />

        <figure>
          <blockquote>
            <p className="max-w-[17ch] font-display text-display-l text-fg">
              Cada viaje empieza con una página en{' '}
              <em className="italic">blanco</em>.
            </p>
          </blockquote>
          <figcaption className="mt-5 kicker kicker-filete">
            Traza tu viaje · Vive el camino
          </figcaption>
        </figure>

        <Postal
          semilla={semilla}
          escena="playa"
          proporcion="16:9"
          redondeo="sheet"
          sello
          selloTono="laton"
          kicker="Día 01 · Tu próximo destino"
          titulo="Todavía por escribir"
          // Decorativa: sin <h3>/<article> antes del H1 del formulario.
          tituloComo="p"
          como="div"
          className="w-full max-w-[420px] shrink-0"
        >
          Tres versiones de tu viaje, con horarios, mapa y presupuesto en USD,
          EUR o DOP.
        </Postal>
      </aside>

      {/* Columna del formulario */}
      <div className="flex min-w-0 flex-1 flex-col lg:col-span-5">
        <PostalArte
          semilla={semilla}
          escena="playa"
          proporcion="3:1"
          className="h-[120px] w-full border-b border-border lg:hidden"
        />
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center px-4 py-10 sm:py-14 lg:px-0">
          <Link
            href="/"
            aria-label="Wayio, inicio"
            className="inline-flex self-start rounded-sm"
          >
            <Logo className="h-[30px] w-auto overflow-visible" />
          </Link>
          {titulo ? (
            <>
              <AuthTitulo titulo={titulo} subtitulo={subtitulo} />
              <div className="mt-8">{children}</div>
            </>
          ) : (
            children
          )}
        </div>
      </div>
    </main>
  )
}
