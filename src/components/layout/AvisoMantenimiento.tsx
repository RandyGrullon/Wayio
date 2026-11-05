'use client'

import { usePathname } from 'next/navigation'
import { Wrench } from 'lucide-react'
import { useMantenimiento } from '@/hooks/useConfigRemota'

/**
 * Aviso de modo mantenimiento (app_settings.maintenance_mode, desde el
 * admin). Lee /api/config con useMantenimiento (caché corta; si falla no se
 * muestra nada) y enseña el mensaje configurado en una banda de 40 px con el
 * tono warning, el mismo formato que los anuncios (AnnouncementBanner). No
 * se puede cerrar: dura lo que dure el mantenimiento. No se muestra en
 * /admin (allí se activa y se desactiva).
 *
 * Mientras está activo, /api/generate, /api/generate/stream y /api/adjust
 * responden 503 code 'mantenimiento' con este mismo mensaje.
 */
export function AvisoMantenimiento() {
  const pathname = usePathname()
  const { activo, mensaje } = useMantenimiento()

  if (!activo || pathname?.startsWith('/admin')) return null

  return (
    <div
      data-print="hide"
      role="status"
      className="bg-warning-bg text-[14px] text-warning-fg"
    >
      <div className="mx-auto flex min-h-10 max-w-content items-center gap-2.5 px-4 py-1.5 md:px-6 lg:px-8">
        <Wrench
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-[18px] shrink-0"
        />
        <p className="min-w-0 flex-1 leading-snug">
          <span className="font-semibold">En mantenimiento</span>
          <span> · {mensaje}</span>
        </p>
      </div>
    </div>
  )
}
