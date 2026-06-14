'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { GroupRoom } from '@/components/group/GroupRoom'
import { TripMap } from '@/components/map/TripMap'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useUser } from '@/hooks/useUser'
import type { Trip } from '@/types/trip'
import type { TripRow } from '@/types/database'

export default function GroupPage() {
  const params = useParams()
  const grupoLink = params['id'] as string
  const router = useRouter()

  const { user, loading: userLoading } = useUser()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [tripId, setTripId] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userLoading) return
    if (!user) {
      router.push(`/login?redirect=/group/${grupoLink}`)
      return
    }

    const joinAndLoad = async () => {
      try {
        // Join the group (upsert member)
        const joinRes = await fetch(`/api/groups/${grupoLink}`, {
          method: 'POST',
        })
        if (!joinRes.ok) {
          const { error: joinErr } = (await joinRes.json()) as { error: string }
          throw new Error(joinErr)
        }
        const { tripId: tid } = (await joinRes.json()) as { tripId: string }
        setTripId(tid)

        // Load trip data
        const tripRes = await fetch(`/api/trips/${tid}`)
        if (!tripRes.ok) throw new Error('No se pudo cargar el viaje')
        const { trip: row } = (await tripRes.json()) as { trip: TripRow }
        setTrip(row.data)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Error al unirte al grupo'
        )
      } finally {
        setPageLoading(false)
      }
    }

    joinAndLoad()
  }, [user, userLoading, grupoLink, router])

  if (userLoading || pageLoading) {
    return (
      <main className="bg-aurora flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-2 w-48 overflow-hidden rounded-full bg-surface-muted">
            <div className="grad-brand h-full w-1/2 animate-pulse rounded-full" />
          </div>
          <p className="text-sm text-fg-muted">Cargando sala grupal...</p>
        </div>
      </main>
    )
  }

  if (error || !trip || !tripId || !user) {
    return (
      <main className="bg-aurora flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="font-medium text-red-600">
            {error ?? 'Error al cargar el grupo'}
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:underline"
          >
            ← Volver al inicio
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Inicio">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grad-brand flex h-11 w-11 items-center justify-center rounded-2xl text-white">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-fg">
              {trip.destino}
            </h1>
            <p className="text-sm text-fg-muted">
              Sala grupal · {trip.personas} viajero
              {trip.personas !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Map with group */}
        <div className="mb-6 h-64 overflow-hidden rounded-3xl border border-border shadow-[var(--shadow-soft)]">
          <TripMap dias={trip.dias} />
        </div>

        {/* Group room */}
        <div className="rounded-3xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)] sm:p-6">
          <GroupRoom tripId={tripId} trip={trip} currentUser={user} />
        </div>
      </div>
    </main>
  )
}
