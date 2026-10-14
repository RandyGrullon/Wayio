'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { PlanTier } from '@/types/subscription'

interface ProState {
  tier: PlanTier
  loading: boolean
}

export interface UseProReturn extends ProState {
  /** Vuelve a pedir el plan (p. ej. al volver del pago). */
  refresh: () => Promise<void>
}

function esTier(v: unknown): v is PlanTier {
  return v === 'free' || v === 'pro' || v === 'grupo'
}

/**
 * Plan efectivo del usuario con la RPC `my_effective_tier` de la BD (MON-04):
 * cubre active, trialing y past_due (gracia) y la caducidad del pase «Pro por
 * viaje». Nunca lanza: sin Supabase, sin sesión o si la RPC falla → 'free'.
 * Solo sirve para la UI (mostrar u ocultar); el servidor decide con
 * getEffectiveTier().
 */
async function leerTier(): Promise<PlanTier> {
  if (!isSupabaseConfigured()) return 'free'
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 'free'
    const { data, error } = await supabase.rpc('my_effective_tier')
    if (error) return 'free'
    return esTier(data) ? data : 'free'
  } catch {
    return 'free'
  }
}

export function usePro(): UseProReturn {
  const [state, setState] = useState<ProState>({ tier: 'free', loading: true })

  useEffect(() => {
    let vivo = true
    void leerTier().then((tier) => {
      if (vivo) setState({ tier, loading: false })
    })
    return () => {
      vivo = false
    }
  }, [])

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    const tier = await leerTier()
    setState({ tier, loading: false })
  }, [])

  return { ...state, refresh }
}
