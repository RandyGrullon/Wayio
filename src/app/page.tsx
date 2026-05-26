'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { TripForm } from '@/components/trip/TripForm'
import { TripMap } from '@/components/map/TripMap'
import { PackageCompare } from '@/components/trip/PackageCompare'
import { BudgetDisplay } from '@/components/trip/BudgetDisplay'
import { ActivityItem } from '@/components/trip/ActivityItem'
import { RecreateTrip } from '@/components/trip/RecreateTrip'
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

  const handleSubmit = async (form: TripFormType) => {
    setStep('loading')
    setLoadingStep(0)
    setError(null)
    setFormData(form)
    setSelectedPackage(form.paquete)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!response.ok) throw new Error('Error generando el itinerario')

      const result = (await response.json()) as GenerateResult
      setAllPackages(result)
      setWeather(result.weather)
      setStep('packages')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setStep('form')
    }
  }

  const handleRecreateTripConfirm = (
    destino: string,
    _lugares: PlaceFromVideo[]
  ) => {
    setShowRecreate(false)
    // Pre-fill the form step with the detected destination
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

  // ── Loading ───────────────────────────────────────────────────────────────
  if (step === 'loading') {
    const current = LOADING_STEPS[loadingStep]
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <div className="text-center">
          <div className="mb-6 text-6xl">{current?.icono ?? '✈️'}</div>
          <div className="mb-2 h-2 w-64 overflow-hidden rounded-full bg-blue-200">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all duration-1000"
              style={{
                width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%`,
              }}
            />
          </div>
          <p className="mt-4 text-lg font-medium text-gray-700">
            {current?.mensaje ?? ''}
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Generando 3 paquetes en paralelo...
          </p>
        </div>
      </main>
    )
  }

  // ── Package selection ─────────────────────────────────────────────────────
  if (step === 'packages' && allPackages) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          {formData ? (
            <p className="mb-6 text-center text-sm text-gray-500">
              {allPackages.basico.destino} · {formData.personas} persona
              {formData.personas !== 1 ? 's' : ''} · {formData.fechaInicio} →{' '}
              {formData.fechaFin}
            </p>
          ) : null}
          <div className="rounded-2xl bg-white p-6 shadow-lg">
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
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {itinerary.destino}
              </h1>
              {formData ? (
                <p className="mt-0.5 text-sm text-gray-500">
                  {formData.personas} persona
                  {formData.personas !== 1 ? 's' : ''} · {formData.fechaInicio}{' '}
                  → {formData.fechaFin} ·{' '}
                  <span className="capitalize">{itinerary.paquete}</span>
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveTrip}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving
                  ? 'Guardando...'
                  : user
                    ? 'Guardar viaje'
                    : 'Guardar (inicia sesión)'}
              </button>
              <button
                onClick={() => setStep('packages')}
                className="text-sm text-blue-600 hover:underline"
              >
                Cambiar paquete
              </button>
              <button
                onClick={() => setStep('form')}
                className="text-sm text-gray-400 hover:underline"
              >
                Nuevo viaje
              </button>
            </div>
          </div>

          {/* Weather strip */}
          {weather ? (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-sky-50 px-4 py-3 text-sm">
              <Image
                src={`https://openweathermap.org/img/wn/${weather.icon}.png`}
                alt={weather.description}
                width={40}
                height={40}
                unoptimized
              />
              <span className="font-semibold text-gray-800">
                {Math.round(weather.temp)}°C
              </span>
              <span className="capitalize text-gray-600">
                {weather.description}
              </span>
              <span className="text-gray-400">
                · {weather.humidity}% humedad
              </span>
              <span className="text-gray-400">
                · {weather.windSpeed} m/s viento
              </span>
            </div>
          ) : null}

          {/* Map */}
          <div className="mb-6 h-72 overflow-hidden rounded-xl shadow-sm">
            <TripMap dias={itinerary.dias} />
          </div>

          {/* Summary */}
          <p className="mb-6 text-gray-600">{itinerary.resumenViaje}</p>

          {/* Budget */}
          <div className="mb-4">
            <BudgetDisplay
              dias={itinerary.dias}
              currency={formData?.moneda ?? 'USD'}
              totalBudget={itinerary.presupuestoTotal}
            />
          </div>

          {/* Budget per person */}
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <p className="text-gray-500">Presupuesto total</p>
              <p className="font-semibold">${itinerary.presupuestoTotal}</p>
            </div>
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <p className="text-gray-500">Por persona</p>
              <p className="font-semibold">
                ${itinerary.presupuestoPorPersona}
              </p>
            </div>
          </div>

          {/* Warnings */}
          {itinerary.advertencias.length > 0 ? (
            <div className="mb-4 rounded-lg bg-amber-50 p-4">
              <p className="mb-2 font-medium text-amber-800">Advertencias</p>
              <ul className="list-disc pl-4 text-sm text-amber-700">
                {itinerary.advertencias.map((adv, i) => (
                  <li key={i}>{adv}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Days */}
          <div className="flex flex-col gap-4">
            {itinerary.dias.map((dia) => (
              <div key={dia.numero} className="rounded-xl bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      Día {dia.numero}: {dia.titulo}
                    </h2>
                    <p className="text-xs text-gray-400">{dia.ciudad}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-500">
                    ${dia.presupuestoDia}
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {dia.actividades.map((act) => (
                    <ActivityItem key={act.id} activity={act} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Tips */}
          {itinerary.consejos.length > 0 ? (
            <div className="mt-4 rounded-lg bg-blue-50 p-4">
              <p className="mb-2 font-medium text-blue-800">Consejos</p>
              <ul className="list-disc pl-4 text-sm text-blue-700">
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
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12">
        <div className="mx-auto max-w-lg">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">TripMind</h1>
            <p className="mt-2 text-gray-600">
              Planifica tu viaje perfecto con IA
            </p>
          </div>
          {error ? (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <TripForm onSubmit={handleSubmit} />
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
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900">TripMind</h1>
          <p className="mt-4 text-xl text-gray-600">
            Planificación de viajes con IA y GPS en vivo
          </p>
          <p className="mt-2 text-gray-500">
            Dinos a dónde quieres ir, cuánto tienes, y la IA arma tu viaje
            perfecto.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              onClick={() => setStep('form')}
              className="rounded-lg bg-blue-600 px-8 py-4 text-lg font-medium text-white transition-colors hover:bg-blue-700"
            >
              Planificar mi viaje
            </button>
            <button
              onClick={() => setShowRecreate(true)}
              className="rounded-lg border border-blue-300 bg-white px-6 py-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
            >
              Recrea este viaje (desde video)
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
