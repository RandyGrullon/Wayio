'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Segmented } from '@/components/ui/Segmented'

/**
 * Periodo del Panel, 7 d | 30 d | 90 d (docs/DISENO.md §6.12), sincronizado
 * con ?rango=. El periodo por defecto no se escribe en la URL.
 */
export function SelectorRango({
  basePath,
  valor,
  opciones,
  porDefecto,
}: {
  basePath: string
  valor: number
  opciones: readonly number[]
  porDefecto: number
}) {
  const router = useRouter()
  const [elegido, setElegido] = useState(String(valor))
  const [previo, setPrevio] = useState(valor)
  const [pendiente, start] = useTransition()

  // Si la URL cambia desde fuera (atrás/adelante), el control se pone al día.
  if (previo !== valor) {
    setPrevio(valor)
    setElegido(String(valor))
  }

  const cambiar = (v: string) => {
    setElegido(v)
    const destino =
      Number(v) === porDefecto ? basePath : `${basePath}?rango=${v}`
    start(() => router.push(destino, { scroll: false }))
  }

  return (
    <div aria-busy={pendiente || undefined}>
      <Segmented
        label="Periodo"
        options={opciones.map((d) => ({
          value: String(d),
          label: `${d} d`,
          ariaLabel: `Últimos ${d} días`,
        }))}
        value={elegido}
        onValueChange={cambiar}
      />
    </div>
  )
}
