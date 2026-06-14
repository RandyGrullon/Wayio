'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Sparkles,
  MapPin,
  Wallet,
  CalendarDays,
  Users,
  Video,
  Plane,
  CloudSun,
  Star,
  ChevronLeft,
  CalendarPlus,
  Printer,
  RefreshCw,
  Hotel,
  Pencil,
  Check,
  Share2,
} from 'lucide-react'
import { downloadIcs } from '@/lib/utils/ics'
import {
  buildSkyscannerLink,
  buildBookingLink,
} from '@/constants/affiliateLinks'
import { TripForm } from '@/components/trip/TripForm'
import { TripMap } from '@/components/map/TripMap'
import { PackageCompare } from '@/components/trip/PackageCompare'
import { BudgetDisplay } from '@/components/trip/BudgetDisplay'
import { EditableDays } from '@/components/trip/EditableDays'
import { AdjustChat } from '@/components/trip/AdjustChat'
import { RecreateTrip } from '@/components/trip/RecreateTrip'
import { useBackgroundGeocode } from '@/hooks/useBackgroundGeocode'
import { streamGenerate } from '@/lib/ai/streamClient'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { Button } from '@/components/ui/Button'
import { useUser } from '@/hooks/useUser'
import type { TripForm as TripFormType } from '@/lib/validations/tripForm'
import type { Trip } from '@/types/trip'
import type { WeatherData } from '@/lib/api/openweather'
import type { GenerateResult } from '@/app/api/generate/route'
import type { PlaceFromVideo } from '@/lib/ai/analyzeVideo'

const LOADING_STEPS = [
  {
    mensaje: 'Buscando vuelos desde tu ciudad...',
    icono: '✈️',
    duracion: 2000,
  },
  {
    mensaje: 'Encontrando los mejores hoteles...',
    icono: '🏨',
    duracion: 2000,
  },
  {
    mensaje: 'Descubriendo actividades increíbles...',
    icono: '🗺️',
    duracion: 2000,
  },
  {
    mensaje: 'La IA está armando 3 versiones de tu viaje...',
    icono: '🤖',
    duracion: 3000,
  },
  {
    mensaje: 'Optimizando rutas para que no pierdas tiempo...',
    icono: '📍',
    duracion: 1000,
  },
] as const

type AppStep = 'landing' | 'form' | 'loading' | 'packages' | 'result'

function DemoBanner({ motivo }: { motivo?: string | undefined }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-2xl border border-sun-200 bg-sun-50 px-4 py-3 text-sm text-sun-800 dark:border-sun-500/30 dark:bg-sun-500/10 dark:text-sun-200">
      <span>🧪</span>
      <p>
        <span className="font-semibold">Modo demo:</span>{' '}
        {motivo ?? (
          <>
            datos de ejemplo (Tokio). Configura una API key de IA (Groq o
            Anthropic) en el{' '}
            <code className="rounded bg-black/10 px-1 dark:bg-white/10">
              .env
            </code>{' '}
            para generar itinerarios reales.
          </>
        )}
      </p>
    </div>
  )
}

const FEATURES = [
  {
    icon: Sparkles,
    title: 'IA que entiende tu viaje',
    desc: 'Describe tu plan ideal y la IA arma 3 paquetes a tu medida en segundos.',
  },
  {
    icon: MapPin,
    title: 'GPS en vivo',
    desc: 'Navega tu itinerario día a día con guía de ubicación en tiempo real.',
  },
  {
    icon: Wallet,
    title: 'A tu presupuesto',
    desc: 'Ajustamos vuelos, hoteles y actividades a lo que quieres gastar.',
  },
] as const

export default function HomePage() {
  const router = useRouter()
  const { user } = useUser()
  const [step, setStep] = useState<AppStep>('landing')
  const [loadingStep, setLoadingStep] = useState(0)
  const [allPackages, setAllPackages] = useState<GenerateResult | null>(null)
  const [selectedPackage, setSelectedPackage] = useState<
    'basico' | 'confort' | 'premium'
  >('confort')
  const [itinerary, setItinerary] = useState<Trip | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [formData, setFormData] = useState<TripFormType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showRecreate, setShowRecreate] = useState(false)
  const [editing, setEditing] = useState(false)
  const [streamLabel, setStreamLabel] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  // Rellena coords de las actividades que la IA no ancló, tras mostrar el viaje.
  useBackgroundGeocode(step === 'result' ? itinerary : null, setItinerary)

  useEffect(() => {
    if (step !== 'loading') return
    let current = 0
    const advance = () => {
      if (current < LOADING_STEPS.length - 1) {
        current++
        setLoadingStep(current)
        setTimeout(advance, LOADING_STEPS[current]?.duracion ?? 2000)
      }
    }
    const timerId = setTimeout(advance, LOADING_STEPS[0]?.duracion ?? 2000)
    return () => clearTimeout(timerId)
  }, [step])

  const handleSubmit = async (form: TripFormType, noCache = false) => {
    setStep('loading')
    setLoadingStep(0)
    setError(null)
    setStreamLabel(null)
    setFormData(form)
    setSelectedPackage(form.paquete)

    try {
      let result: GenerateResult
      try {
        // Streaming: progreso real del backend en vez del loader cronometrado.
        result = await streamGenerate(form, noCache, {
          onProgress: (label) => setStreamLabel(label),
        })
      } catch {
        // Fallback no-streaming si el stream falla (proxy, navegador, etc.).
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, noCache }),
        })
        if (!response.ok) throw new Error('Error generando el itinerario')
        result = (await response.json()) as GenerateResult
      }

      setAllPackages(result)
      setWeather(result.weather)
      setStep('packages')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setStep('form')
    }
  }

  const handleRegenerate = () => {
    if (formData) void handleSubmit(formData, true)
  }

  const handleRecreateTripConfirm = (
    destino: string,
    _lugares: PlaceFromVideo[]
  ) => {
    setShowRecreate(false)
    setFormData((prev) => ({
      destino,
      destinoSorpresa: false,
      origen: prev?.origen ?? '',
      personas: prev?.personas ?? 2,
      fechaInicio: prev?.fechaInicio ?? '',
      fechaFin: prev?.fechaFin ?? '',
      presupuesto: prev?.presupuesto ?? 2000,
      moneda: prev?.moneda ?? 'USD',
      tipo: prev?.tipo ?? 'aventura',
      paquete: prev?.paquete ?? 'confort',
    }))
    setStep('form')
  }

  const handleSelectPackage = (paquete: 'basico' | 'confort' | 'premium') => {
    if (!allPackages) return
    setSelectedPackage(paquete)
    setItinerary(allPackages[paquete])
    setEditing(false)
    setStep('result')
  }

  const handleSaveTrip = async () => {
    if (!itinerary) return
    if (!user) {
      router.push('/login?redirect=/')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip: itinerary }),
      })
      if (!res.ok) throw new Error('Error guardando viaje')
      const { trip: saved } = (await res.json()) as { trip: { id: string } }
      router.push(`/trip/${saved.id}`)
    } catch {
      // Non-fatal — stay on result page
    } finally {
      setSaving(false)
    }
  }

  const handleShare = async () => {
    if (!itinerary) return
    if (!user) {
      router.push('/login?redirect=/')
      return
    }
    setSharing(true)
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip: itinerary }),
      })
      if (!res.ok) throw new Error('Error guardando viaje para compartir')
      const { trip: saved } = (await res.json()) as { trip: { id: string } }
      const url = `${window.location.origin}/viaje-compartido/${saved.id}`
      setShareUrl(url)
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        // El usuario puede copiar manualmente el link que mostramos.
      }
    } catch {
      // Non-fatal — el botón vuelve a su estado normal.
    } finally {
      setSharing(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (step === 'loading') {
    const current = LOADING_STEPS[loadingStep]
    const pct = ((loadingStep + 1) / LOADING_STEPS.length) * 100
    return (
      <main className="bg-aurora flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="animate-float mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-surface text-6xl shadow-[var(--shadow-soft)]">
            {current?.icono ?? '✈️'}
          </div>
          <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="grad-brand h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-lg font-semibold text-fg">
            {streamLabel ?? current?.mensaje}
          </p>
          <p className="mt-2 text-sm text-fg-subtle">
            {streamLabel
              ? 'Progreso en vivo de tu generación...'
              : 'Generando 3 paquetes en paralelo...'}
          </p>
        </div>
      </main>
    )
  }

  // ── Package selection ─────────────────────────────────────────────────────
  if (step === 'packages' && allPackages) {
    return (
      <main className="bg-aurora min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <button
            onClick={() => setStep('form')}
            className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
          >
            <ChevronLeft className="h-4 w-4" /> Volver
          </button>
          {allPackages.demo ? <DemoBanner motivo={allPackages.motivo} /> : null}
          {formData ? (
            <p className="mb-6 text-center text-sm text-fg-muted">
              {allPackages.basico.destino} · {formData.personas} persona
              {formData.personas !== 1 ? 's' : ''} · {formData.fechaInicio} →{' '}
              {formData.fechaFin}
            </p>
          ) : null}
          <div className="animate-rise rounded-3xl border border-border bg-surface/80 p-5 shadow-[var(--shadow-soft)] backdrop-blur sm:p-7">
            <PackageCompare
              basico={allPackages.basico}
              confort={allPackages.confort}
              premium={allPackages.premium}
              selected={selectedPackage}
              moneda={formData?.moneda ?? 'USD'}
              onSelect={handleSelectPackage}
            />
          </div>
        </div>
      </main>
    )
  }

  // ── Result ────────────────────────────────────────────────────────────────
  if (step === 'result' && itinerary) {
    return (
      <main className="min-h-screen bg-bg">
        <SiteHeader />
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
          {allPackages?.demo ? (
            <DemoBanner motivo={allPackages.motivo} />
          ) : null}

          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
                {itinerary.destino}
              </h1>
              {formData ? (
                <p className="mt-1 text-sm text-fg-muted">
                  {formData.personas} persona
                  {formData.personas !== 1 ? 's' : ''} · {formData.fechaInicio}{' '}
                  → {formData.fechaFin} ·{' '}
                  <span className="font-semibold capitalize text-brand-600">
                    {itinerary.paquete}
                  </span>
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSaveTrip} loading={saving} size="sm">
                {user ? 'Guardar viaje' : 'Guardar (inicia sesión)'}
              </Button>
              <Button
                variant={editing ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setEditing((e) => !e)}
                title="Editar el itinerario antes de guardar"
              >
                {editing ? (
                  <>
                    <Check className="h-4 w-4" />
                    Listo
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" />
                    Editar
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(false)
                  setStep('packages')
                }}
              >
                Cambiar paquete
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                loading={sharing}
                title="Crear un link público de solo lectura"
              >
                <Share2 className="h-4 w-4" />
                {user ? 'Compartir' : 'Compartir (inicia sesión)'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                title="Generar otra versión del itinerario"
              >
                <RefreshCw className="h-4 w-4" />
                Otra versión
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => itinerary && downloadIcs(itinerary)}
                title="Exportar a calendario (.ics)"
              >
                <CalendarPlus className="h-4 w-4" />
                Calendario
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                title="Imprimir o guardar como PDF"
              >
                <Printer className="h-4 w-4" />
                PDF
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false)
                  setStep('form')
                }}
              >
                Nuevo viaje
              </Button>
            </div>
          </div>

          {/* Link público de compartir */}
          {shareUrl ? (
            <div className="mb-4 flex flex-col gap-1 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm dark:border-brand-500/30 dark:bg-brand-500/10">
              <span className="font-semibold text-brand-700 dark:text-brand-200">
                ¡Link de solo lectura copiado!
              </span>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-brand-600 underline dark:text-brand-300"
              >
                {shareUrl}
              </a>
            </div>
          ) : null}

          {/* Weather strip */}
          {weather ? (
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm dark:border-brand-500/30 dark:bg-brand-500/10">
              <Image
                src={`https://openweathermap.org/img/wn/${weather.icon}.png`}
                alt={weather.description}
                width={40}
                height={40}
                unoptimized
              />
              <span className="text-lg font-bold text-fg">
                {Math.round(weather.temp)}°C
              </span>
              <span className="capitalize text-fg-muted">
                {weather.description}
              </span>
              <span className="text-fg-subtle">
                · {weather.humidity}% humedad
              </span>
              <span className="text-fg-subtle">
                · {weather.windSpeed} m/s viento
              </span>
            </div>
          ) : null}

          {/* Map */}
          <div className="mb-6 h-72 overflow-hidden rounded-3xl border border-border shadow-[var(--shadow-soft)]">
            <TripMap dias={itinerary.dias} />
          </div>

          {/* Ajustes con IA (chat) */}
          <div className="mb-6">
            <AdjustChat
              trip={itinerary}
              onAdjusted={(updated) =>
                setItinerary({ ...updated, id: crypto.randomUUID() })
              }
            />
          </div>

          {/* Summary */}
          <p className="mb-6 text-fg-muted">{itinerary.resumenViaje}</p>

          {/* Budget */}
          <div className="mb-4">
            <BudgetDisplay
              dias={itinerary.dias}
              currency={formData?.moneda ?? 'USD'}
              totalBudget={itinerary.presupuestoTotal}
            />
          </div>

          {/* Budget cards */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
              <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                Presupuesto total
              </p>
              <p className="mt-1 text-xl font-bold text-fg">
                ${itinerary.presupuestoTotal}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
              <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                Por persona
              </p>
              <p className="mt-1 text-xl font-bold text-fg">
                ${itinerary.presupuestoPorPersona}
              </p>
            </div>
          </div>

          {/* Reservas (afiliados) */}
          <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-fg">
              ¿Listo para reservar?
            </p>
            <div className="flex flex-wrap gap-2">
              {formData ? (
                <a
                  href={buildSkyscannerLink(
                    formData.origen,
                    itinerary.destino,
                    formData.fechaInicio
                  )}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-muted"
                >
                  <Plane className="h-4 w-4 text-brand-500" /> Buscar vuelos
                </a>
              ) : null}
              <a
                href={buildBookingLink(
                  itinerary.destino,
                  itinerary.fechaInicio
                )}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-muted"
              >
                <Hotel className="h-4 w-4 text-coral-500" /> Buscar hoteles
              </a>
            </div>
          </div>

          {/* Warnings */}
          {itinerary.advertencias.length > 0 ? (
            <div className="mb-4 rounded-2xl border border-sun-200 bg-sun-50 p-4 dark:border-sun-500/30 dark:bg-sun-500/10">
              <p className="mb-2 font-semibold text-sun-800 dark:text-sun-200">
                Advertencias
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-sun-700 dark:text-sun-300">
                {itinerary.advertencias.map((adv, i) => (
                  <li key={i}>{adv}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Days */}
          {editing ? (
            <p className="mb-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
              Modo edición: mueve, edita, borra o añade actividades. Pulsa{' '}
              <span className="font-semibold">Listo</span> cuando termines.
            </p>
          ) : null}
          <EditableDays
            dias={itinerary.dias}
            editing={editing}
            onChange={(dias) =>
              setItinerary((prev) => (prev ? { ...prev, dias } : prev))
            }
          />

          {/* Tips */}
          {itinerary.consejos.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
              <p className="mb-2 font-semibold text-brand-800 dark:text-brand-200">
                Consejos
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-brand-700 dark:text-brand-300">
                {itinerary.consejos.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </main>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  if (step === 'form') {
    return (
      <main className="bg-aurora min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
          <button
            onClick={() => setStep('landing')}
            className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
          >
            <ChevronLeft className="h-4 w-4" /> Volver al inicio
          </button>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-10">
            {/* Brand / value panel */}
            <aside className="lg:sticky lg:top-24">
              <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-fg-muted shadow-[var(--shadow-soft)]">
                <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                Planificación con IA
              </span>
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-fg sm:text-4xl lg:text-5xl">
                Diseña tu viaje <span className="text-gradient">perfecto</span>
              </h1>
              <p className="mt-3 max-w-md text-pretty text-fg-muted">
                Cuéntanos los detalles y la IA arma 3 paquetes a tu medida en
                segundos —vuelos, hoteles y actividades incluidos.
              </p>

              <ul className="mt-7 hidden flex-col gap-4 lg:flex">
                {FEATURES.map(({ icon: Icon, title, desc }) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="grad-brand mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-fg">{title}</p>
                      <p className="text-sm text-fg-muted">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>

            {/* Form card */}
            <div>
              {error ? (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </div>
              ) : null}
              <div className="animate-rise rounded-3xl border border-border bg-surface/80 p-6 shadow-[var(--shadow-soft)] backdrop-blur sm:p-8">
                <TripForm onSubmit={handleSubmit} />
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ── Landing ───────────────────────────────────────────────────────────────
  return (
    <>
      {showRecreate ? (
        <RecreateTrip
          onConfirm={handleRecreateTripConfirm}
          onClose={() => setShowRecreate(false)}
        />
      ) : null}
      <main className="bg-aurora relative min-h-screen overflow-hidden">
        <SiteHeader />

        {/* Hero */}
        <section className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-16 pt-10 text-center sm:px-6 sm:pt-16 lg:pt-24">
          <span className="animate-rise mb-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-4 py-1.5 text-xs font-semibold text-fg-muted shadow-[var(--shadow-soft)] backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-brand-500" />
            Tu copiloto de viajes con IA
          </span>

          <h1 className="animate-rise max-w-3xl text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-fg sm:text-6xl lg:text-7xl">
            Tu viaje perfecto,{' '}
            <span className="text-gradient">planificado en segundos</span>
          </h1>

          <p className="animate-rise mt-6 max-w-xl text-pretty text-lg text-fg-muted">
            Dinos a dónde quieres ir y cuánto tienes. La IA arma tu itinerario
            completo —vuelos, hoteles y actividades— y te guía con GPS en vivo.
          </p>

          <div className="animate-rise mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <Button
              size="xl"
              onClick={() => setStep('form')}
              fullWidth
              className="sm:w-64"
            >
              Planificar
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="xl"
              variant="outline"
              onClick={() => setShowRecreate(true)}
              fullWidth
              className="sm:w-64"
            >
              <Video className="h-5 w-5" />
              Desde un video
            </Button>
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm text-fg-subtle">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-sun-400 text-sun-400" />
              ))}
            </div>
            Gratis para empezar · Sin tarjeta
          </div>

          {/* Floating preview cards */}
          <div className="pointer-events-none relative mt-14 hidden w-full max-w-4xl md:block">
            <div className="grid grid-cols-3 items-stretch gap-4">
              {[
                {
                  icon: Plane,
                  color: 'text-brand-500',
                  t: 'Vuelos óptimos',
                  d: 'Las mejores rutas a tu presupuesto.',
                },
                {
                  icon: MapPin,
                  color: 'text-coral-500',
                  t: 'Ruta día a día',
                  d: 'Sin perder tiempo entre lugares.',
                },
                {
                  icon: CloudSun,
                  color: 'text-sun-500',
                  t: 'Clima incluido',
                  d: 'Empaca según el pronóstico.',
                },
              ].map(({ icon: Icon, color, t, d }) => (
                <div
                  key={t}
                  className="animate-float flex h-full min-h-[150px] flex-col rounded-3xl border border-border bg-surface/80 p-5 text-left shadow-[var(--shadow-soft)] backdrop-blur"
                >
                  <Icon className={`h-6 w-6 ${color}`} />
                  <p className="mt-3 font-bold text-fg">{t}</p>
                  <p className="text-sm text-fg-subtle">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-3xl border border-border bg-surface p-6 shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-1"
              >
                <div className="grad-brand inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-fg">{title}</h3>
                <p className="mt-1 text-sm text-fg-muted">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="grad-brand relative overflow-hidden rounded-[2rem] px-6 py-12 text-center text-white sm:px-12">
            <div className="relative z-10 mx-auto max-w-2xl">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Tres pasos. Cero estrés.
              </h2>
              <div className="mt-8 grid gap-6 text-left sm:grid-cols-3">
                {[
                  {
                    icon: CalendarDays,
                    t: 'Cuéntanos tu plan',
                    d: 'Destino, fechas, personas y presupuesto.',
                  },
                  {
                    icon: Sparkles,
                    t: 'La IA genera 3 versiones',
                    d: 'Básico, confort y premium a tu medida.',
                  },
                  {
                    icon: Users,
                    t: 'Viaja y comparte',
                    d: 'GPS en vivo, gastos y grupos.',
                  },
                ].map(({ icon: Icon, t, d }, i) => (
                  <div key={t}>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                        {i + 1}
                      </span>
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-3 font-bold">{t}</p>
                    <p className="text-sm text-white/80">{d}</p>
                  </div>
                ))}
              </div>
              <Button
                size="lg"
                variant="secondary"
                className="mt-10 bg-white text-brand-700 hover:bg-white/90"
                onClick={() => setStep('form')}
              >
                Empezar ahora
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </section>

        <footer className="border-t border-border py-8 text-center text-sm text-fg-subtle">
          © {new Date().getFullYear()} Wayio · Hecho con IA para viajeros.
        </footer>
      </main>
    </>
  )
}
