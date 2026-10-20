'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AccionConCupo } from '@/constants/planes'
import { haySesionLocal } from '@/lib/auth/irALogin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { PlanTier } from '@/types/subscription'

/** Uso de una acción con cupo en el mes en curso. */
export interface UsoAccion {
  usados: number
  limite: number
}

/**
 * Cupo del mes (GET /api/cupo). `cupos` null = Pro sin límite (con uso
 * justo). `renueva` es 'YYYY-MM-DD' (día 1 del mes siguiente, hora de RD).
 */
export interface Cupo {
  tier: PlanTier | null
  cupos: Record<AccionConCupo, UsoAccion> | null
  renueva: string | null
  /** El servidor no pudo contar con exactitud (cifras orientativas). */
  aproximado: boolean
}

export interface UseCupoReturn {
  /** null sin sesión, en modo demo (sin Supabase) o si la petición falla. */
  cupo: Cupo | null
  loading: boolean
  /** Vuelve a pedir el cupo (p. ej. tras gastar o al reintentar). */
  refresh: () => Promise<void>
}

const ACCIONES: readonly AccionConCupo[] = ['generar', 'ajustar', 'analizar']

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const entero = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null

function esTier(v: unknown): v is PlanTier {
  return v === 'free' || v === 'pro' || v === 'grupo'
}

function leerUso(v: unknown): UsoAccion | null {
  if (!esObjeto(v)) return null
  const usados = entero(v['usados'])
  const limite = entero(v['limite'])
  return usados === null || limite === null ? null : { usados, limite }
}

/** Valida el cuerpo de GET /api/cupo; null si no tiene la forma esperada. */
function leerCuerpo(data: unknown): Cupo | null {
  if (!esObjeto(data)) return null
  const tier = esTier(data['tier']) ? data['tier'] : null
  const renueva =
    typeof data['renueva'] === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(data['renueva'])
      ? data['renueva']
      : null
  const aproximado = data['aproximado'] === true
  const crudos = data['cupos']
  if (crudos === null) return { tier, cupos: null, renueva, aproximado }
  if (!esObjeto(crudos)) return null
  const cupos = {} as Record<AccionConCupo, UsoAccion>
  for (const accion of ACCIONES) {
    const uso = leerUso(crudos[accion])
    if (!uso) return null
    cupos[accion] = uso
  }
  return { tier, cupos, renueva, aproximado }
}

/**
 * Lee el cupo del mes. Nunca lanza: sin Supabase (modo demo), sin sesión
 * (se mira la sesión local antes de pedir nada), con 401 o con cualquier
 * fallo devuelve null. Solo sirve para mostrar el uso; el servidor decide.
 */
export async function leerCupo(): Promise<Cupo | null> {
  if (!isSupabaseConfigured()) return null
  try {
    if ((await haySesionLocal()) === false) return null
    const res = await fetch('/api/cupo', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return leerCuerpo(await res.json())
  } catch {
    return null
  }
}

/** Cupo del mes del usuario con sesión (ver leerCupo). */
export function useCupo(): UseCupoReturn {
  const [estado, setEstado] = useState<{
    cupo: Cupo | null
    loading: boolean
  }>(() => ({ cupo: null, loading: isSupabaseConfigured() }))

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    let vivo = true
    void leerCupo().then((cupo) => {
      if (vivo) setEstado({ cupo, loading: false })
    })
    return () => {
      vivo = false
    }
  }, [])

  const refresh = useCallback(async () => {
    setEstado((s) => ({ ...s, loading: true }))
    const cupo = await leerCupo()
    setEstado({ cupo, loading: false })
  }, [])

  return { ...estado, refresh }
}
