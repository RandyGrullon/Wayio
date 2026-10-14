'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CopyPlus } from 'lucide-react'
import type { Trip } from '@/types/trip'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useUser } from '@/hooks/useUser'
import { track } from '@/lib/analytics/events'
import { isSupabaseConfigured } from '@/lib/supabase/config'

interface CopiarAMisViajesProps {
  trip: Trip
  /** Id público del viaje (para volver aquí tras iniciar sesión). */
  compartidoId: string
}

function nuevoId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `viaje-${Date.now().toString(36)}`
}

/**
 * «Copiar a mis viajes» (docs/DISENO.md §6.7): botón invertido sobre la banda
 * primaria. Sin sesión lleva a iniciar sesión y vuelve aquí; con sesión crea
 * una copia propia (POST /api/trips) y abre el viaje.
 */
export function CopiarAMisViajes({
  trip,
  compartidoId,
}: CopiarAMisViajesProps) {
  const router = useRouter()
  const { user } = useUser()
  const { error } = useToast()
  const [copiando, setCopiando] = useState(false)

  if (!isSupabaseConfigured()) return null

  const login = `/login?redirect=${encodeURIComponent(`/viaje-compartido/${compartidoId}`)}`

  const copiar = async () => {
    if (!user) {
      router.push(login)
      return
    }
    setCopiando(true)
    try {
      const copia: Trip = {
        ...trip,
        id: nuevoId(),
        actividadesPendientes: [],
        dias: trip.dias.map((d) => ({
          ...d,
          actividades: d.actividades.map((a) => ({
            ...a,
            estado: 'pendiente' as const,
            esPerdida: false,
            reservaPagada: false,
          })),
        })),
      }
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip: copia }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        trip?: { id?: string }
        error?: string
      }
      if (res.ok && data.trip?.id) {
        track('viaje_guardado', {
          tripId: data.trip.id,
          destino: copia.destino,
          dias: copia.dias.length,
        })
        router.push(`/trip/${data.trip.id}`)
        return
      }
      if (res.status === 401) {
        router.push(login)
        return
      }
      error(data.error ?? 'No pudimos copiar el viaje. Inténtalo de nuevo.')
    } catch {
      error('No pudimos copiar el viaje. Revisa tu conexión.')
    } finally {
      setCopiando(false)
    }
  }

  return (
    <Button
      variant="soft"
      size="lg"
      icon={<CopyPlus />}
      loading={copiando}
      loadingText="Copiando…"
      onClick={() => void copiar()}
      className="bg-primary-fg text-primary-text hover:bg-primary-fg/90 focus-visible:outline-primary-fg dark:hover:bg-primary-fg/90"
    >
      Copiar a mis viajes
    </Button>
  )
}
