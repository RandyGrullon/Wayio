'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { formatNumero } from '@/lib/utils/formatters'

/**
 * Número editable de la calculadora (US$, %, usuarios). Guarda el texto que
 * escribe el dueño y solo propaga valores válidos y dentro de rango; mientras
 * tanto muestra el error. Acepta «0.40», «1,000» y también «0,40» (coma
 * decimal con 1–2 cifras). Para cambiarlo desde fuera (restablecer), el
 * padre le cambia la `key`.
 */

export function leerNumero(texto: string): number | null {
  let limpio = texto.trim().replace(/\s|US\$|%/g, '')
  if (/^-?\d+,\d{1,2}$/.test(limpio)) limpio = limpio.replace(',', '.')
  else limpio = limpio.replace(/,/g, '')
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(limpio)) return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

function textoInicial(valor: number): string {
  return Number.isInteger(valor)
    ? String(valor)
    : String(Number(valor.toFixed(6)))
}

export function CampoNumero({
  label,
  etiquetaOculta = false,
  valor,
  onCambio,
  min = 0,
  max,
  entero = false,
  sufijo,
  hint,
  className,
}: {
  label: string
  /** El label no se ve (va como aria-label): filas de la lista de costos. */
  etiquetaOculta?: boolean
  valor: number
  onCambio: (valor: number) => void
  min?: number
  max: number
  entero?: boolean
  /** Unidad al final del campo («%», «US$», «/mes»). */
  sufijo?: string
  hint?: string
  className?: string
}) {
  const [texto, setTexto] = useState(() => textoInicial(valor))
  const n = leerNumero(texto)
  const error =
    texto.trim() === ''
      ? 'Escribe un número'
      : n === null
        ? 'No es un número'
        : n < min || n > max
          ? `Entre ${formatNumero(min)} y ${formatNumero(max)}`
          : entero && !Number.isInteger(n)
            ? 'Sin decimales'
            : undefined

  return (
    <Input
      fieldSize="md"
      {...(etiquetaOculta ? { 'aria-label': label } : { label })}
      inputMode={entero ? 'numeric' : 'decimal'}
      autoComplete="off"
      spellCheck={false}
      value={texto}
      onChange={(e) => {
        const t = e.target.value
        setTexto(t)
        const v = leerNumero(t)
        if (
          v !== null &&
          v >= min &&
          v <= max &&
          (!entero || Number.isInteger(v))
        ) {
          onCambio(v)
        }
      }}
      error={error}
      {...(hint ? { hint } : {})}
      {...(sufijo
        ? {
            suffix: (
              <span
                aria-hidden="true"
                className="pr-2.5 text-body-s text-fg-muted"
              >
                {sufijo}
              </span>
            ),
          }
        : {})}
      {...(className ? { containerClassName: className } : {})}
      className="tnum"
    />
  )
}
