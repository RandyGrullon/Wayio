'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Check,
  Pencil,
  Share2,
  RefreshCw,
  CalendarPlus,
  Printer,
  Layers,
  Plus,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

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
}

/**
 * Compact result toolbar: the two primary actions (Guardar, Editar) stay
 * visible; everything secondary collapses into a "Más" overflow menu so the
 * header reads clean instead of a wall of buttons.
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
}: ResultActionsProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={onSave} loading={saving} size="sm">
        {isAuthed ? 'Guardar viaje' : 'Guardar (inicia sesión)'}
      </Button>

      <Button
        variant={editing ? 'primary' : 'outline'}
        size="sm"
        onClick={onToggleEdit}
        title="Editar el itinerario antes de guardar"
      >
        {editing ? (
          <>
            <Check className="h-4 w-4" /> Listo
          </>
        ) : (
          <>
            <Pencil className="h-4 w-4" /> Editar
          </>
        )}
      </Button>

      <div className="relative" ref={menuRef}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Más acciones"
        >
          <MoreHorizontal className="h-4 w-4" /> Más
        </Button>

        {open ? (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-[var(--shadow-lg,0_10px_30px_rgba(0,0,0,0.18))]"
          >
            <MenuItem
              icon={<Layers className="h-4 w-4" />}
              label="Cambiar paquete"
              onClick={run(onChangePackage)}
            />
            <MenuItem
              icon={<Share2 className="h-4 w-4" />}
              label={isAuthed ? 'Compartir' : 'Compartir (inicia sesión)'}
              onClick={run(onShare)}
              loading={sharing}
            />
            <MenuItem
              icon={<RefreshCw className="h-4 w-4" />}
              label="Otra versión"
              onClick={run(onRegenerate)}
            />
            <MenuItem
              icon={<CalendarPlus className="h-4 w-4" />}
              label="Añadir a calendario"
              onClick={run(onCalendar)}
            />
            <MenuItem
              icon={<Printer className="h-4 w-4" />}
              label="Exportar PDF"
              onClick={run(onPrint)}
            />
            <div className="my-1 h-px bg-border" />
            <MenuItem
              icon={<Plus className="h-4 w-4" />}
              label="Nuevo viaje"
              onClick={run(onNewTrip)}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  loading,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  loading?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-fg transition-colors hover:bg-surface-muted disabled:opacity-60"
    >
      <span className="text-fg-muted">{icon}</span>
      {label}
    </button>
  )
}
