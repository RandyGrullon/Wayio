'use client'

import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { Hotel, Sparkles, Plane, ExternalLink, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'

// Local copy of the backend search contract (mirrors '@/lib/api/types').
interface SearchResult {
  id: string
  title: string
  subtitle?: string
  price?: number
  currency?: string
  url?: string
  provider: 'amadeus' | 'booking' | 'viator'
}

interface SearchResponse {
  configured: boolean
  results: SearchResult[]
  error?: string
}

interface RealSearchProps {
  destino: string
  fechaInicio: string
  fechaFin: string
  personas: number
  origen: string
}

type SectionState = {
  loading: boolean
  data: SearchResponse | null
  error: string | null
}

const PROVIDER_LABEL: Record<SearchResult['provider'], string> = {
  amadeus: 'Amadeus',
  booking: 'Booking',
  viator: 'Viator',
}

const initialState: SectionState = { loading: false, data: null, error: null }

function formatPrice(price?: number, currency?: string): string | null {
  if (price === undefined || price === null) return null
  return currency ? `${price} ${currency}` : `${price}`
}

async function fetchSearch(url: string): Promise<SearchResponse> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return (await res.json()) as SearchResponse
}

function ResultCard({ result }: { result: SearchResult }) {
  const price = formatPrice(result.price, result.currency)
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-bg p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-fg">{result.title}</p>
        {result.subtitle ? (
          <p className="mt-0.5 truncate text-xs text-fg-muted">
            {result.subtitle}
          </p>
        ) : null}
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
          {PROVIDER_LABEL[result.provider]}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {price ? (
          <span className="text-sm font-bold text-fg">{price}</span>
        ) : null}
        {result.url ? (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex items-center gap-1 rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-surface-muted"
          >
            Ver <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </div>
  )
}

function NotConfigured({ provider }: { provider: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-bg px-3 py-2.5 text-xs text-fg-subtle">
      Búsqueda real no configurada — agrega la API key de {provider} en
      .env.local
    </p>
  )
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-coral-200 bg-coral-50 px-3 py-2.5 text-xs text-coral-700 dark:border-coral-500/30 dark:bg-coral-500/10 dark:text-coral-300">
      {message}
    </p>
  )
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl border border-border bg-surface-muted"
        />
      ))}
    </div>
  )
}

function Section({
  icon,
  title,
  state,
  provider,
  children,
}: {
  icon: React.ReactNode
  title: string
  state: SectionState
  provider: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold text-fg">{title}</h4>
      </div>
      {children}
      {state.loading ? (
        <LoadingRows />
      ) : state.error ? (
        <ErrorNote message={state.error} />
      ) : state.data && !state.data.configured ? (
        <NotConfigured provider={provider} />
      ) : state.data?.error ? (
        <ErrorNote message={state.data.error} />
      ) : state.data && state.data.results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-bg px-3 py-2.5 text-xs text-fg-subtle">
          Sin resultados.
        </p>
      ) : state.data ? (
        <div className="space-y-2">
          {state.data.results.map((r) => (
            <ResultCard key={r.id} result={r} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function RealSearch({
  destino,
  fechaInicio,
  fechaFin,
  personas,
}: RealSearchProps) {
  const [hotels, setHotels] = useState<SectionState>(initialState)
  const [activities, setActivities] = useState<SectionState>(initialState)
  const [flights, setFlights] = useState<SectionState>(initialState)

  const [iataOrigin, setIataOrigin] = useState('')
  const [iataDest, setIataDest] = useState('')

  const runSearch = useCallback(
    async (
      url: string,
      setter: React.Dispatch<React.SetStateAction<SectionState>>
    ) => {
      setter({ loading: true, data: null, error: null })
      try {
        const data = await fetchSearch(url)
        setter({ loading: false, data, error: null })
      } catch (err) {
        setter({
          loading: false,
          data: null,
          error: err instanceof Error ? err.message : 'Error de búsqueda',
        })
      }
    },
    []
  )

  useEffect(() => {
    if (!destino) return
    const hotelsUrl = `/api/hotels?destination=${encodeURIComponent(
      destino
    )}&checkIn=${encodeURIComponent(fechaInicio)}&checkOut=${encodeURIComponent(
      fechaFin
    )}&guests=${encodeURIComponent(String(personas))}`
    const activitiesUrl = `/api/activities?destination=${encodeURIComponent(
      destino
    )}&date=${encodeURIComponent(fechaInicio)}`
    void runSearch(hotelsUrl, setHotels)
    void runSearch(activitiesUrl, setActivities)
  }, [destino, fechaInicio, fechaFin, personas, runSearch])

  const onFlightSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      const origin = iataOrigin.trim().toUpperCase()
      const dest = iataDest.trim().toUpperCase()
      if (origin.length !== 3 || dest.length !== 3) return
      const url = `/api/flights?origin=${encodeURIComponent(
        origin
      )}&destination=${encodeURIComponent(dest)}&date=${encodeURIComponent(
        fechaInicio
      )}&adults=${encodeURIComponent(String(personas))}`
      void runSearch(url, setFlights)
    },
    [iataOrigin, iataDest, fechaInicio, personas, runSearch]
  )

  const flightsValid =
    iataOrigin.trim().length === 3 && iataDest.trim().length === 3

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-500" />
        <p className="text-sm font-semibold text-fg">Búsqueda en tiempo real</p>
      </div>

      <Section
        icon={<Hotel className="h-4 w-4 text-coral-500" />}
        title="Hoteles"
        state={hotels}
        provider="Booking"
      />

      <Section
        icon={<Sparkles className="h-4 w-4 text-brand-500" />}
        title="Actividades"
        state={activities}
        provider="Viator"
      />

      <Section
        icon={<Plane className="h-4 w-4 text-brand-500" />}
        title="Vuelos"
        state={flights}
        provider="Amadeus"
      >
        <form onSubmit={onFlightSubmit} className="mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={iataOrigin}
              onChange={(e) => setIataOrigin(e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="Origen"
              aria-label="Origen (código IATA)"
              className="w-24 rounded-xl border border-border bg-bg px-3 py-2 text-sm uppercase text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:outline-none"
            />
            <input
              value={iataDest}
              onChange={(e) => setIataDest(e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="Destino"
              aria-label="Destino (código IATA)"
              className="w-24 rounded-xl border border-border bg-bg px-3 py-2 text-sm uppercase text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:outline-none"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={!flightsValid}
              loading={flights.loading}
            >
              <Search className="h-4 w-4" /> Buscar
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-fg-subtle">
            Usa códigos IATA (ej. MAD, JFK)
          </p>
        </form>
      </Section>
    </div>
  )
}
