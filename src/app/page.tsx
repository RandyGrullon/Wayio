'use client'

import { useState, useEffect } from 'react'
import { TripForm } from '@/components/trip/TripForm'
import { TripMap } from '@/components/map/TripMap'
import type { TripForm as TripFormType } from '@/lib/validations/tripForm'
import type { Trip } from '@/types/trip'

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
    mensaje: 'La IA está armando tu viaje perfecto...',
    icono: '🤖',
    duracion: 3000,
  },
  {
    mensaje: 'Optimizando la ruta para que no pierdas tiempo...',
    icono: '📍',
    duracion: 1000,
  },
] as const

type AppStep = 'landing' | 'form' | 'loading' | 'result'

export default function HomePage() {
  const [step, setStep] = useState<AppStep>('landing')
  const [loadingStep, setLoadingStep] = useState(0)
  const [itinerary, setItinerary] = useState<Trip | null>(null)
  const [formData, setFormData] = useState<TripFormType | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    return () => {
      clearTimeout(timerId)
    }
  }, [step])

  const handleSubmit = async (form: TripFormType) => {
    setStep('loading')
    setLoadingStep(0)
    setError(null)
    setFormData(form)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        throw new Error('Error generando el itinerario')
      }

      const body = response.body
      if (!body) {
        throw new Error('Sin respuesta del servidor')
      }

      const reader = body.getReader()
      const decoder = new TextDecoder()
      let json = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        json += decoder.decode(value, { stream: true })
      }

      const partial = JSON.parse(json) as Omit<
        Trip,
        | 'id'
        | 'origen'
        | 'personas'
        | 'fechaInicio'
        | 'fechaFin'
        | 'paquete'
        | 'listaActividades'
        | 'actividadesPendientes'
      >
      const trip: Trip = {
        ...partial,
        id: crypto.randomUUID(),
        origen: form.origen,
        personas: form.personas,
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        paquete: form.paquete,
        listaActividades: [],
        actividadesPendientes: [],
      }
      setItinerary(trip)
      setStep('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setStep('form')
    }
  }

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
        </div>
      </main>
    )
  }

  if (step === 'result' && itinerary) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {itinerary.destino}
              </h1>
              {formData ? (
                <p className="text-sm text-gray-500 mt-0.5">
                  {formData.personas} persona
                  {formData.personas !== 1 ? 's' : ''} · {formData.fechaInicio}{' '}
                  → {formData.fechaFin} · {itinerary.paquete}
                </p>
              ) : null}
            </div>
            <button
              onClick={() => setStep('form')}
              className="text-sm text-blue-600 hover:underline"
            >
              Nuevo viaje
            </button>
          </div>

          <div className="mb-6 h-72 rounded-xl overflow-hidden shadow-sm">
            <TripMap dias={itinerary.dias} />
          </div>

          <p className="mb-6 text-gray-600">{itinerary.resumenViaje}</p>

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

          <div className="flex flex-col gap-4">
            {itinerary.dias.map((dia) => (
              <div
                key={dia.numero}
                className="rounded-xl bg-white p-4 shadow-sm"
              >
                <h2 className="mb-1 font-semibold text-gray-900">
                  Día {dia.numero}: {dia.titulo}
                </h2>
                <p className="mb-3 text-sm text-gray-500">{dia.ciudad}</p>
                <div className="flex flex-col gap-2">
                  {dia.actividades.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-start gap-3 text-sm"
                    >
                      <span className="min-w-[48px] text-gray-400">
                        {act.horaInicio}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">
                          {act.nombre}
                        </p>
                        <p className="text-gray-500">{act.direccion}</p>
                      </div>
                      <span className="text-gray-700">
                        ${act.precioEstimado}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

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

  return (
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
        <div className="mt-8">
          <button
            onClick={() => setStep('form')}
            className="rounded-lg bg-blue-600 px-8 py-4 text-lg font-medium text-white transition-colors hover:bg-blue-700"
          >
            Planificar mi viaje
          </button>
        </div>
      </div>
    </main>
  )
}
