'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import { TripMap } from '@/components/map/TripMap'
import { ActivityItem } from '@/components/trip/ActivityItem'
import { BudgetDisplay } from '@/components/trip/BudgetDisplay'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import type { Trip } from '@/types/trip'
import type { TripRow } from '@/types/database'

/**
 * Vista pública de SOLO LECTURA de un viaje guardado. No requiere sesión: lee
 * el viaje por id vía /api/trips/[id]. A diferencia de /trip/[id], no muestra
 * GPS, reagendamiento ni edición: es para compartir el plan con cualquiera.
 */
export default function SharedTripPage() {
  const params = useParams()
  const tripId = params['id'] as string

  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}`)
        if (!res.ok) throw new Error('Viaje no encontrado o no compartible.')
        const { trip: row } = (await res.json()) as { trip: TripRow }
        if (!cancelled) setTrip(row.data)
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tripId])

  if (loading) {
    return (
      <main className="bg-aurora flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-2 w-48 overflow-hidden rounded-full bg-surface-muted">
            <div className="grad-brand h-full w-1/2 animate-pulse rounded-full" />
          </div>
          <p className="text-sm text-fg-muted">Cargando viaje...</p>
        </div>
      </main>
    )
  }

  if (error || !trip) {
    return (
      <main className="bg-aurora flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="font-medium text-red-600">
            {error ?? 'Viaje no encontrado'}
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:underline"
          >
            ← Crea el tuyo en Wayio
          </Link>
        </div>
      </main>
    )
  }

  const isCrucero = trip.dias.some((d) =>
    d.actividades.some((a) => a.puertoCrucero)
  )

  return (
    <main className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Inicio">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-fg-muted">
              <Eye className="h-3.5 w-3.5" /> Solo lectura
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
            {trip.destino}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            {trip.personas} persona{trip.personas !== 1 ? 's' : ''} ·{' '}
            {trip.fechaInicio} → {trip.fechaFin} ·{' '}
            <span className="font-semibold capitalize text-brand-600">
              {trip.paquete}
            </span>
          </p>
        </div>

        {/* Map */}
        <div className="mb-6 h-72 overflow-hidden rounded-3xl border border-border shadow-[var(--shadow-soft)]">
          <TripMap dias={trip.dias} isCrucero={isCrucero} />
        </div>

        {/* Budget */}
        <div className="mb-4">
          <BudgetDisplay dias={trip.dias} totalBudget={trip.presupuestoTotal} />
        </div>

        {/* Summary */}
        <p className="mb-6 text-fg-muted">{trip.resumenViaje}</p>

        {/* Days */}
        <div className="flex flex-col gap-4">
          {trip.dias.map((dia) => (
            <div
              key={dia.numero}
              className="overflow-hidden rounded-3xl border border-border bg-surface shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="grad-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white">
                    {dia.numero}
                  </span>
                  <div>
                    <h2 className="font-bold text-fg">{dia.titulo}</h2>
                    <p className="text-xs text-fg-subtle">{dia.ciudad}</p>
                  </div>
                </div>
                <span className="rounded-full bg-surface-muted px-3 py-1 text-sm font-semibold text-fg-muted">
                  ${dia.presupuestoDia}
                </span>
              </div>
              <div className="divide-y divide-border">
                {dia.actividades.map((act) => (
                  <ActivityItem key={act.id} activity={act} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tips */}
        {trip.consejos.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
            <p className="mb-2 font-semibold text-brand-800 dark:text-brand-200">
              Consejos
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-brand-700 dark:text-brand-300">
              {trip.consejos.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-8 rounded-3xl border border-border bg-surface p-5 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm font-semibold text-fg">
            ¿Te gusta este plan? Crea el tuyo gratis.
          </p>
          <Link
            href="/"
            className="grad-brand mt-3 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white"
          >
            Planificar mi viaje
          </Link>
        </div>
      </div>
    </main>
  )
}
