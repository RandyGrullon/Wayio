'use client'

import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { CornerDownLeft, Map as MapIcon, Search, Users } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils/cn'
import { itemsPara, normalizar } from './navegacion'
import { usePanel } from './PanelContext'

interface Opcion {
  clave: string
  label: string
  detalle?: string
  href: string
  icono: LucideIcon
}

const sinSuscripcion = () => () => {}
const esMacCliente = () => /Mac|iPhone|iPad/i.test(navigator.userAgent)
const esMacServidor = () => false

/**
 * Búsqueda ⌘K del topbar (docs/DISENO.md §6.12): usuarios por email, viajes
 * por destino y salto a cualquier sección. Combobox con listbox, flechas,
 * Intro y Esc. Ctrl+K / ⌘K la abre desde cualquier pantalla del panel.
 */
export function BusquedaPanel() {
  const [abierto, setAbierto] = useState(false)
  const router = useRouter()
  const esMac = useSyncExternalStore(
    sinSuscripcion,
    esMacCliente,
    esMacServidor
  )

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAbierto((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const ir = (href: string) => {
    setAbierto(false)
    router.push(href)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        className="hidden h-control-sm w-full max-w-[300px] items-center gap-2 rounded-full border border-border-strong bg-surface px-3.5 text-[14px] text-fg-muted transition-colors duration-(--dur-fast) hover:bg-surface-2 hover:text-fg md:inline-flex"
      >
        <Search
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-4 shrink-0"
        />
        <span className="flex-1 truncate text-left">
          Buscar usuarios o viajes
        </span>
        <kbd className="rounded-stamp border border-border px-1.5 font-mono text-[12px] text-fg-subtle">
          {esMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>
      <IconButton
        label="Buscar usuarios o viajes"
        aria-haspopup="dialog"
        className="md:hidden"
        onClick={() => setAbierto(true)}
      >
        <Search strokeWidth={1.75} />
      </IconButton>
      <Modal
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Buscar en el panel"
      >
        <Paleta onIr={ir} />
      </Modal>
    </>
  )
}

function Paleta({ onIr }: { onIr: (href: string) => void }) {
  const id = useId()
  const { esDueno } = usePanel()
  const [q, setQ] = useState('')
  const [activo, setActivo] = useState(0)
  const texto = q.trim()
  const n = normalizar(texto)

  const opciones: Opcion[] = [
    ...(texto
      ? [
          {
            clave: 'usuarios',
            label: `Usuarios con «${texto}»`,
            detalle: 'por email',
            href: `/admin/users?search=${encodeURIComponent(texto)}`,
            icono: Users,
          },
          {
            clave: 'viajes',
            label: `Viajes a «${texto}»`,
            detalle: 'por destino',
            href: `/admin/trips?search=${encodeURIComponent(texto)}`,
            icono: MapIcon,
          },
        ]
      : []),
    ...itemsPara(esDueno)
      .filter((i) => !n || normalizar(i.label).includes(n))
      .map((i) => ({
        clave: i.href,
        label: i.label,
        detalle: 'sección',
        href: i.href,
        icono: i.icono,
      })),
  ]
  const indice = Math.min(activo, Math.max(0, opciones.length - 1))
  const opcionId = (i: number) => `${id}-opcion-${i}`

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (opciones.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo((indice + 1) % opciones.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((indice - 1 + opciones.length) % opciones.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opcion = opciones[indice]
      if (opcion) onIr(opcion.href)
    }
  }

  return (
    <div>
      <Input
        fieldSize="md"
        icon={<Search />}
        data-autofocus
        role="combobox"
        aria-label="Buscar usuarios, viajes o secciones"
        aria-expanded="true"
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={
          opciones.length > 0 ? opcionId(indice) : undefined
        }
        autoComplete="off"
        spellCheck={false}
        placeholder="Email, destino o sección"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setActivo(0)
        }}
        onKeyDown={onKeyDown}
      />
      <ul
        id={`${id}-lista`}
        role="listbox"
        aria-label="Resultados"
        className="mt-3 max-h-80 space-y-0.5 overflow-y-auto"
      >
        {opciones.map((o, i) => {
          const Icono = o.icono
          const seleccionada = i === indice
          return (
            <li
              key={o.clave}
              id={opcionId(i)}
              role="option"
              aria-selected={seleccionada}
              onMouseMove={() => setActivo(i)}
              onClick={() => onIr(o.href)}
              className={cn(
                'flex h-11 cursor-pointer items-center gap-3 rounded-control px-3 text-[15px] transition-colors duration-(--dur-instant)',
                seleccionada ? 'bg-surface-2 text-fg' : 'text-fg-muted'
              )}
            >
              <Icono
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-[18px] shrink-0"
              />
              <span className="min-w-0 flex-1 truncate font-medium">
                {o.label}
              </span>
              {o.detalle ? (
                <span className="shrink-0 text-caption text-fg-subtle">
                  {o.detalle}
                </span>
              ) : null}
              {seleccionada ? (
                <CornerDownLeft
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4 shrink-0 text-fg-subtle"
                />
              ) : null}
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-caption text-fg-subtle">
        Flechas para moverte · Intro para abrir · Esc para cerrar
      </p>
    </div>
  )
}
