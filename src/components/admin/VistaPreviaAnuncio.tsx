import type { CSSProperties } from 'react'
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { AnnouncementRow } from '@/types/admin'

type Nivel = AnnouncementRow['level']

const ESTILOS: Record<Nivel, { clases: string; Icono: LucideIcon }> = {
  info: { clases: 'bg-info-bg text-info-fg', Icono: Info },
  warning: { clases: 'bg-warning-bg text-warning-fg', Icono: AlertTriangle },
  critical: { clases: 'bg-danger-bg text-danger-fg', Icono: AlertCircle },
}

/**
 * Valores del tema CLARO (docs/DISENO.md §2.1) para forzarlo en la vista
 * previa aunque el panel esté en oscuro. El oscuro se fuerza con la propia
 * clase `.dark`, que redefine los tokens en cualquier elemento.
 */
const CLARO = {
  colorScheme: 'light',
  '--bg': '#f7f4ee',
  '--fg': '#0f1e2e',
  '--fg-muted': '#46525f',
  '--border': '#e2dcd0',
  '--info-bg': '#eff7f5',
  '--info-fg': '#1a4a48',
  '--warning-bg': '#fbf1d9',
  '--warning-fg': '#6b4800',
  '--danger-bg': '#fdeeec',
  '--danger-fg': '#912018',
} as CSSProperties

/**
 * Vista previa del banner de anuncios en un tema concreto, con el mismo
 * aspecto que AnnouncementBanner (banda de 40 px, icono, texto y cierre).
 */
export function VistaPreviaAnuncio({
  tema,
  titulo,
  cuerpo,
  nivel,
}: {
  tema: 'claro' | 'oscuro'
  titulo: string
  cuerpo: string
  nivel: Nivel
}) {
  const { clases, Icono } = ESTILOS[nivel] ?? ESTILOS.info
  const t = titulo.trim() || 'Título del anuncio'
  const c = cuerpo.trim()
  return (
    <figure className="min-w-0">
      <figcaption className="kicker mb-2">
        {tema === 'claro' ? 'Tema claro' : 'Tema oscuro'}
      </figcaption>
      <div
        className={cn(
          'overflow-hidden rounded-control border border-border bg-bg text-fg',
          tema === 'oscuro' && 'dark'
        )}
        style={tema === 'claro' ? CLARO : undefined}
        role="img"
        aria-label={`Anuncio en tema ${tema}: ${t}${c ? `. ${c}` : ''}`}
      >
        <div className={cn('text-[14px]', clases)}>
          <div className="flex min-h-10 items-center gap-2.5 py-1.5 pr-1.5 pl-4">
            <Icono
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-[18px] shrink-0"
            />
            <p className="min-w-0 flex-1 leading-snug break-words">
              <span className="font-semibold">{t}</span>
              {c ? <span> · {c}</span> : null}
            </p>
            <span
              aria-hidden="true"
              className="inline-grid size-9 shrink-0 place-items-center rounded-full"
            >
              <X strokeWidth={1.75} className="size-[18px]" />
            </span>
          </div>
        </div>
        <div aria-hidden="true" className="flex items-center gap-3 px-4 py-3">
          <span className="h-2 w-16 rounded-full bg-fg/15" />
          <span className="h-2 w-24 rounded-full bg-fg/10" />
          <span className="ml-auto h-2 w-10 rounded-full bg-fg/10" />
        </div>
      </div>
    </figure>
  )
}
