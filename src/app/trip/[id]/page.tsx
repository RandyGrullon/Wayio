'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Share2, Check, LogOut, Eye } from 'lucide-react'
import { TripMap } from '@/components/map/TripMap'
import { ActivityItem } from '@/components/trip/ActivityItem'
import { BudgetDisplay } from '@/components/trip/BudgetDisplay'
import { ConflictDisplay } from '@/components/trip/ConflictDisplay'
import { AlertLevel5Cruise } from '@/components/alerts/AlertLevel5Cruise'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { useTrip } from '@/hooks/useTrip'
import { useGPS } from '@/hooks/useGPS'
import { signOut } from '@/lib/auth/actions'
import type { Activity } from '@/types/activity'
import type { Conflict } from '@/types/conflicts'
import type { Alert } from '@/types/alerts'

export default function TripPage() {
  const params = useParams()
  const tripId = params['id'] as string

  const {
    trip,
    grupoLink,
    actividadesPendientes,
    loading,
    error,
    loadTrip,
    markActivityLost,
    rescheduleActivity,
    acceptReschedule,
  } = useTrip(tripId)

  const { location, startWatching, stopWatching, watching } = useGPS()
  const [rescheduleTarget, setRescheduleTarget] = useState<Activity | null>(
    null
  )
  const [rescheduleResult, setRescheduleResult] = useState<Activity | null>(
    null
  )
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [dismissedConflicts, setDismissedConflicts] = useState<Set<string>>(
    new Set()
  )
  const [boardingAlert, setBoardingAlert] = useState<Alert | null>(null)
  const validateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  )

  useEffect(() => {
    loadTrip()
  }, [loadTrip])

  useEffect(() => {
    if (!trip) return
    const dias = trip.dias

    const validate = async () => {
      try {
        const res = await fetch('/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dias }),
        })
        if (!res.ok) return
        const data = (await res.json()) as { conflicts: Conflict[] }
        setConflicts(data.conflicts)
      } catch {
        // best-effort
      }
    }

    void validate()
    validateIntervalRef.current = setInterval(() => void validate(), 30000)
    return () => {
      if (validateIntervalRef.current)
        clearInterval(validateIntervalRef.current)
    }
  }, [trip])

  // Boarding alert: check every minute if any port activity is within 90 min
  useEffect(() => {
    if (!trip) return
    const checkBoarding = () => {
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()
      for (const day of trip.dias) {
        for (const act of day.actividades) {
          if (!act.puertoCrucero || !act.tiempoEmbarqueMinutos) continue
          const [h = '0', m = '0'] = act.horaInicio.split(':')
          const actMin = parseInt(h, 10) * 60 + parseInt(m, 10)
          const deadline = actMin - 90
          if (nowMin >= deadline && nowMin < actMin) {
            setBoardingAlert({
              id: `boarding-${act.id}`,
              level: 5,
              title: '¡Atención! Regresa al crucero',
              message: `Debes embarcar antes de las ${act.horaInicio}. Tiempo restante: ${actMin - nowMin} min.`,
              activityId: act.id,
              timestamp: Date.now(),
              acknowledged: false,
              actions: [{ label: 'Ir al mapa', type: 'navigate' }],
            })
            return
          }
        }
      }
      setBoardingAlert(null)
    }
    checkBoarding()
    const id = setInterval(checkBoarding, 60000)
    return () => clearInterval(id)
  }, [trip])

  const handleMarkLost = async (activity: Activity) => {
    await markActivityLost(activity.id)
    setRescheduleTarget(activity)
  }

  const handleReschedule = async () => {
    if (!rescheduleTarget) return
    setRescheduleLoading(true)
    const result = await rescheduleActivity(
      rescheduleTarget.id,
      'El usuario la perdió o no pudo asistir'
    )
    setRescheduleResult(result)
    setRescheduleLoading(false)
  }

  const handleAcceptReschedule = async () => {
    if (!rescheduleTarget || !rescheduleResult) return
    await acceptReschedule(rescheduleTarget, rescheduleResult)
    setRescheduleTarget(null)
    setRescheduleResult(null)
  }

  const handleCopyGroupLink = () => {
    if (!grupoLink) return
    const url = `${window.location.origin}/group/${grupoLink}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleCopyShareLink = () => {
    const url = `${window.location.origin}/viaje-compartido/${tripId}`
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    })
  }

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
            ← Volver al inicio
          </Link>
        </div>
      </main>
    )
  }

  const isCrucero =
    trip.paquete !== undefined &&
    trip.dias.some((d) => d.actividades.some((a) => a.puertoCrucero))
  const visibleConflicts = conflicts.filter(
    (c) => !dismissedConflicts.has(c.id)
  )

  return (
    <main className="min-h-screen bg-bg">
      {boardingAlert ? (
        <AlertLevel5Cruise
          alert={boardingAlert}
          onDismiss={() => setBoardingAlert(null)}
        />
      ) : null}

      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Inicio">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="icon" title="Salir">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
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
          <div className="flex flex-wrap items-center gap-2">
            {grupoLink ? (
              <Button variant="outline" size="sm" onClick={handleCopyGroupLink}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4" /> ¡Copiado!
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" /> Compartir grupo
                  </>
                )}
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyShareLink}
              title="Copiar link público de solo lectura"
            >
              {shareCopied ? (
                <>
                  <Check className="h-4 w-4" /> ¡Copiado!
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" /> Compartir vista
                </>
              )}
            </Button>
            <Button
              variant={watching ? 'primary' : 'outline'}
              size="sm"
              onClick={() => (watching ? stopWatching() : startWatching())}
            >
              <MapPin className="h-4 w-4" />
              {watching ? 'GPS activo' : 'GPS off'}
            </Button>
          </div>
        </div>

        {/* Map */}
        <div className="mb-6 h-72 overflow-hidden rounded-3xl border border-border shadow-[var(--shadow-soft)]">
          <TripMap
            dias={trip.dias}
            isCrucero={isCrucero}
            {...(location
              ? {
                  userLocation: {
                    lat: location.lat,
                    lng: location.lng,
                    accuracy: location.accuracy,
                    timestamp: location.timestamp,
                  },
                }
              : {})}
          />
        </div>

        {/* Reagendamiento */}
        {rescheduleTarget ? (
          <div className="mb-4 rounded-2xl border border-sun-200 bg-sun-50 p-4 dark:border-sun-500/30 dark:bg-sun-500/10">
            <p className="mb-2 font-semibold text-sun-800 dark:text-sun-200">
              Actividad perdida: {rescheduleTarget.nombre}
            </p>
            {rescheduleResult ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-fg-muted">
                  La IA sugiere reagendar para:{' '}
                  <strong className="text-fg">
                    {rescheduleResult.horaInicio} – {rescheduleResult.horaFin}
                  </strong>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleAcceptReschedule}
                    className="rounded-xl bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => {
                      setRescheduleTarget(null)
                      setRescheduleResult(null)
                    }}
                    className="rounded-xl border border-border-strong px-3 py-1.5 text-xs font-semibold text-fg-muted hover:bg-surface-muted"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleReschedule}
                  disabled={rescheduleLoading}
                  className="grad-brand rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {rescheduleLoading ? 'Buscando...' : 'Buscar nueva hora'}
                </button>
                <button
                  onClick={() => setRescheduleTarget(null)}
                  className="rounded-xl border border-border-strong px-3 py-1.5 text-xs font-semibold text-fg-muted hover:bg-surface-muted"
                >
                  Guardar como perdida
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* Pending activities */}
        {actividadesPendientes.length > 0 ? (
          <div className="mb-4 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
            <p className="mb-2 text-sm font-semibold text-fg">
              Actividades pendientes para tu próxima visita
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-fg-muted">
              {actividadesPendientes.map((a) => (
                <li key={a.id}>{a.nombre}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Budget */}
        <div className="mb-4">
          <BudgetDisplay dias={trip.dias} totalBudget={trip.presupuestoTotal} />
        </div>

        {/* Summary */}
        <p className="mb-6 text-fg-muted">{trip.resumenViaje}</p>

        {/* Warnings */}
        {trip.advertencias.length > 0 ? (
          <div className="mb-4 rounded-2xl border border-sun-200 bg-sun-50 p-4 dark:border-sun-500/30 dark:bg-sun-500/10">
            <p className="mb-2 font-semibold text-sun-800 dark:text-sun-200">
              Advertencias
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-sun-700 dark:text-sun-300">
              {trip.advertencias.map((adv, i) => (
                <li key={i}>{adv}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Conflicts */}
        {visibleConflicts.length > 0 ? (
          <div className="mb-4">
            <ConflictDisplay
              conflicts={visibleConflicts}
              onDismiss={(id) =>
                setDismissedConflicts((s) => new Set([...s, id]))
              }
            />
          </div>
        ) : null}

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
                  <div key={act.id} className="px-2">
                    <ActivityItem
                      activity={act}
                      {...(act.estado !== 'perdida'
                        ? { onSelect: handleMarkLost }
                        : {})}
                    />
                    {act.estado === 'perdida' ? (
                      <p className="pb-2 pl-[60px] text-xs font-semibold text-red-500">
                        Actividad perdida
                      </p>
                    ) : null}
                  </div>
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
      </div>
    </main>
  )
}
