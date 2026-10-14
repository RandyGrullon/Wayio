'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { IconButton, Spinner } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils/cn'

/**
 * Búsqueda de una lista del panel (docs/DISENO.md §6.12): campo h-control-md
 * de w-full / sm:w-80 con botón limpiar. Conserva los demás searchParams y
 * reinicia la página.
 */
export function SearchBar({
  basePath,
  actuales,
  etiqueta,
  placeholder,
  param = 'search',
  className,
}: {
  basePath: string
  /** searchParams actuales (planos). */
  actuales: Record<string, string>
  /** Nombre accesible («Buscar usuarios por email»). */
  etiqueta: string
  placeholder: string
  param?: string
  className?: string
}) {
  const router = useRouter()
  const enUrl = actuales[param] ?? ''
  const [valor, setValor] = useState(enUrl)
  const [previo, setPrevio] = useState(enUrl)
  const [cargando, start] = useTransition()

  // Si la URL cambia desde fuera (p. ej. «Limpiar búsqueda» del estado
  // vacío), el campo se pone al día sin remontarse ni perder el foco.
  if (previo !== enUrl) {
    setPrevio(enUrl)
    setValor(enUrl)
  }

  const ir = (texto: string) => {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(actuales)) {
      if (k !== param && k !== 'page') params.set(k, v)
    }
    const limpio = texto.trim()
    if (limpio) params.set(param, limpio)
    const qs = params.toString()
    start(() => router.push(qs ? `${basePath}?${qs}` : basePath))
  }

  return (
    <form
      role="search"
      aria-label={etiqueta}
      onSubmit={(e) => {
        e.preventDefault()
        ir(valor)
      }}
      className={cn('w-full sm:w-80', className)}
    >
      <Input
        fieldSize="md"
        icon={<Search />}
        aria-label={etiqueta}
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        aria-busy={cargando || undefined}
        suffix={
          cargando ? (
            <span className="grid size-control-sm place-items-center text-fg-subtle">
              <Spinner />
            </span>
          ) : valor ? (
            <IconButton
              label="Limpiar búsqueda"
              size="icon-sm"
              onClick={() => {
                setValor('')
                ir('')
              }}
            >
              <X strokeWidth={1.75} />
            </IconButton>
          ) : null
        }
      />
    </form>
  )
}
