import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { ButtonLink } from '@/components/ui/Button'

/**
 * Pantalla del panel cuando el entorno no tiene base de datos (producción
 * sin Supabase). No muestra el shell ni ningún dato.
 */
export function PanelNoDisponible() {
  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="reticula flex flex-1 items-center justify-center px-4 py-24 focus:outline-none"
    >
      <div className="w-full max-w-[480px] text-center">
        <Logo title="Wayio" className="mx-auto h-[30px] w-auto" />
        <h1 className="mt-10 font-display text-h1 text-fg">
          El panel no está disponible
        </h1>
        <p className="mx-auto mt-3 max-w-[44ch] text-body text-fg-muted">
          Este entorno todavía no tiene conectada la base de datos de Wayio.
          Cuando lo esté, podrás entrar con tu cuenta de administrador.
        </p>
        <ButtonLink
          href="/"
          variant="tinta"
          icon={<ArrowLeft />}
          className="mt-8"
        >
          Volver a la app
        </ButtonLink>
      </div>
    </main>
  )
}
