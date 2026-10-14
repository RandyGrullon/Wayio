'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/Tabs'

export interface Pestana {
  valor: string
  label: string
  count?: number
  /** Contenido ya pintado en el servidor. */
  contenido: ReactNode
}

/**
 * Pestañas de las fichas de detalle (Resumen | Viajes | Suscripción…). La
 * pestaña elegida se refleja en ?tab= para poder compartir el enlace.
 */
export function PestanasDetalle({
  pestanas,
  inicial,
  etiqueta,
}: {
  pestanas: readonly Pestana[]
  inicial?: string | undefined
  /** Nombre accesible de la lista de pestañas. */
  etiqueta: string
}) {
  const primera = pestanas[0]?.valor ?? ''
  const [valor, setValor] = useState(
    inicial && pestanas.some((p) => p.valor === inicial) ? inicial : primera
  )

  const cambiar = (v: string) => {
    setValor(v)
    try {
      const url = new URL(window.location.href)
      if (v === primera) url.searchParams.delete('tab')
      else url.searchParams.set('tab', v)
      window.history.replaceState(window.history.state, '', url)
    } catch {
      // Sin History API: la pestaña cambia igual.
    }
  }

  return (
    <Tabs value={valor} onValueChange={cambiar}>
      <TabList label={etiqueta}>
        {pestanas.map((p) => (
          <Tab
            key={p.valor}
            value={p.valor}
            {...(p.count === undefined ? {} : { count: p.count })}
          >
            {p.label}
          </Tab>
        ))}
      </TabList>
      {pestanas.map((p) => (
        <TabPanel key={p.valor} value={p.valor} className="pt-6">
          {p.contenido}
        </TabPanel>
      ))}
    </Tabs>
  )
}
