'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  InterpretResultSchema,
  type InterpretResult,
} from '@/lib/validations/interpret'
import { MAX_DESCRIPCION } from '@/lib/validations/tripForm'
import { track } from '@/lib/analytics/events'
import { hoyLocal } from '@/lib/utils/formatters'

/**
 * Interpretación de la descripción libre con POST /api/interpret (contrato en
 * 00-generacion.md). Se lanza sola al dejar de escribir (debounce), al salir
 * del campo o con «Entender mi viaje». Si la IA no está configurada (503) el
 * bloque «Lo que entendimos» desaparece y el formulario sigue a mano.
 */

export type EstadoInterpretacion =
  | { tipo: 'inactivo' }
  | { tipo: 'cargando'; previo: InterpretResult | null }
  | { tipo: 'listo'; resultado: InterpretResult }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'no-disponible' }

/** Marca de sesión: la interpretación no está disponible en esta instalación. */
const CLAVE_NO_DISPONIBLE = 'wayio-interpret-off'
/** Mínimo de caracteres para interpretar sola (el botón admite desde 3). */
const MIN_AUTO = 15
const ESPERA_MS = 1200

function noDisponible(): boolean {
  try {
    return window.sessionStorage.getItem(CLAVE_NO_DISPONIBLE) === '1'
  } catch {
    return false
  }
}

function marcarNoDisponible(): void {
  try {
    window.sessionStorage.setItem(CLAVE_NO_DISPONIBLE, '1')
  } catch {
    // Sin almacenamiento: se volverá a intentar en la próxima visita.
  }
}

function mensajeDe(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null
  const e = (data as { error?: unknown }).error
  return typeof e === 'string' && e.trim() ? e : null
}

export function useInterpretacion({
  texto,
  inicial,
  onResultado,
}: {
  texto: string
  inicial: InterpretResult | null
  onResultado?: (resultado: InterpretResult) => void
}) {
  const [estado, setEstado] = useState<EstadoInterpretacion>(() =>
    noDisponible()
      ? { tipo: 'no-disponible' }
      : inicial
        ? { tipo: 'listo', resultado: inicial }
        : { tipo: 'inactivo' }
  )
  // Último texto interpretado: no se repite la llamada si no cambió.
  const ultimoRef = useRef<string>(inicial ? texto.trim() : '')
  const abortRef = useRef<AbortController | null>(null)
  const onResultadoRef = useRef(onResultado)
  useEffect(() => {
    onResultadoRef.current = onResultado
  })

  const interpretar = useCallback(async (t: string) => {
    const limpio = t.trim()
    if (limpio.length < 3 || noDisponible()) return
    ultimoRef.current = limpio
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setEstado((prev) => ({
      tipo: 'cargando',
      previo:
        prev.tipo === 'listo'
          ? prev.resultado
          : prev.tipo === 'cargando'
            ? prev.previo
            : null,
    }))
    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: limpio.slice(0, MAX_DESCRIPCION),
          hoy: hoyLocal(),
        }),
        signal: ctrl.signal,
      })
      const data: unknown = await res.json().catch(() => null)
      if (res.status === 503) {
        marcarNoDisponible()
        setEstado({ tipo: 'no-disponible' })
        return
      }
      if (!res.ok) {
        setEstado({
          tipo: 'error',
          mensaje:
            mensajeDe(data) ?? 'No pudimos leer tu descripción ahora mismo.',
        })
        track('interpretacion_usada', { fuente: 'texto', exito: false })
        return
      }
      const r = InterpretResultSchema.safeParse(data)
      if (!r.success) {
        setEstado({
          tipo: 'error',
          mensaje: 'No pudimos leer tu descripción ahora mismo.',
        })
        return
      }
      setEstado({ tipo: 'listo', resultado: r.data })
      onResultadoRef.current?.(r.data)
    } catch {
      if (ctrl.signal.aborted) return
      setEstado({
        tipo: 'error',
        mensaje: 'No pudimos leer tu descripción. Revisa tu conexión.',
      })
    }
  }, [])

  // Debounce: interpreta sola cuando el usuario deja de escribir.
  useEffect(() => {
    const limpio = texto.trim()
    if (limpio.length < MIN_AUTO || limpio === ultimoRef.current) return
    const id = window.setTimeout(() => void interpretar(limpio), ESPERA_MS)
    return () => window.clearTimeout(id)
  }, [texto, interpretar])

  useEffect(() => () => abortRef.current?.abort(), [])

  const entender = useCallback(() => {
    void interpretar(texto)
  }, [interpretar, texto])

  const alSalir = useCallback(() => {
    const limpio = texto.trim()
    if (limpio.length >= MIN_AUTO && limpio !== ultimoRef.current) {
      void interpretar(limpio)
    }
  }, [interpretar, texto])

  return { estado, entender, alSalir }
}
