'use client'

import {
  Bookmark,
  CalendarPlus,
  Check,
  Ellipsis,
  Layers,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Share2,
} from 'lucide-react'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { cn } from '@/lib/utils/cn'

interface ResultActionsProps {
  isAuthed: boolean
  saving: boolean
  sharing: boolean
  editing: boolean
  onSave: () => void
  onToggleEdit: () => void
  onChangePackage: () => void
  onShare: () => void
  onRegenerate: () => void
  onCalendar: () => void
  onPrint: () => void
  onNewTrip: () => void
  className?: string
}

/**
 * Acciones de la portada del resultado (docs/DISENO.md §6.5): primary
 * «Guardar viaje» (sin sesión: «Guardar e iniciar sesión»), outline
 * «Compartir», ghost «Editar» y el menú «Más» (calendario, PDF, otra
 * versión, cambiar versión y nuevo viaje). En móvil el primario ocupa todo el
 * ancho y el resto va en una fila.
 */
export function ResultActions({
  isAuthed,
  saving,
  sharing,
  editing,
  onSave,
  onToggleEdit,
  onChangePackage,
  onShare,
  onRegenerate,
  onCalendar,
  onPrint,
  onNewTrip,
  className,
}: ResultActionsProps) {
  return (
    <div
      data-print="hide"
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center',
        className
      )}
    >
      <Button
        variant="primary"
        size="lg"
        icon={<Bookmark />}
        loading={saving}
        loadingText="Guardando…"
        onClick={onSave}
        className="w-full sm:w-auto"
      >
        {isAuthed ? 'Guardar viaje' : 'Guardar e iniciar sesión'}
      </Button>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          icon={<Share2 />}
          loading={sharing}
          loadingText="Preparando…"
          onClick={onShare}
          className="flex-1 sm:flex-none"
        >
          Compartir
        </Button>
        <Button
          variant="ghost"
          icon={editing ? <Check /> : <Pencil />}
          aria-pressed={editing}
          onClick={onToggleEdit}
          className="flex-1 sm:flex-none"
        >
          {editing ? 'Listo' : 'Editar'}
        </Button>
        <Menu
          label="Más acciones"
          trigger={
            <Ellipsis
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-[18px]"
            />
          }
          triggerClassName={buttonClasses({ variant: 'outline', size: 'icon' })}
          items={[
            {
              key: 'calendario',
              label: 'Añadir al calendario',
              icon: <CalendarPlus />,
              onSelect: onCalendar,
            },
            {
              key: 'pdf',
              label: 'Exportar PDF',
              icon: <Printer />,
              onSelect: onPrint,
            },
            {
              key: 'otra',
              label: 'Otra versión',
              icon: <RefreshCw />,
              onSelect: onRegenerate,
              separatorBefore: true,
            },
            {
              key: 'cambiar',
              label: 'Cambiar versión',
              icon: <Layers />,
              onSelect: onChangePackage,
            },
            {
              key: 'nuevo',
              label: 'Nuevo viaje',
              icon: <Plus />,
              onSelect: onNewTrip,
              separatorBefore: true,
            },
          ]}
        />
      </div>
    </div>
  )
}
