import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Button } from '../ui/Button'
import {
  searchActivities,
  searchFlights,
  searchHotels,
  type SearchProvider,
  type SearchResponse,
  type SearchResult,
} from '../../lib/api/search'
import { colors, radius } from '../../theme'

interface Props {
  destino: string
  fechaInicio: string
  fechaFin: string
  personas: number
}

interface SectionState {
  loading: boolean
  data: SearchResponse | null
  error: string | null
}

const initial: SectionState = { loading: false, data: null, error: null }

const PROVIDER_LABEL: Record<SearchProvider, string> = {
  amadeus: 'Amadeus',
  booking: 'Booking',
  viator: 'Viator',
}

function priceLabel(price?: number, currency?: string): string | null {
  if (price === undefined || price === null) return null
  return currency ? `${price} ${currency}` : `${price}`
}

function ResultRow({ result }: { result: SearchResult }): React.ReactElement {
  const price = priceLabel(result.price, result.currency)
  return (
    <View style={styles.resultRow}>
      <View style={styles.resultMain}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {result.title}
        </Text>
        {result.subtitle ? (
          <Text style={styles.resultSub} numberOfLines={1}>
            {result.subtitle}
          </Text>
        ) : null}
        <Text style={styles.resultProvider}>
          {PROVIDER_LABEL[result.provider]}
        </Text>
      </View>
      <View style={styles.resultRight}>
        {price ? <Text style={styles.resultPrice}>{price}</Text> : null}
        {result.url ? (
          <TouchableOpacity
            onPress={() => void Linking.openURL(result.url as string)}
            style={styles.resultLink}
          >
            <Text style={styles.resultLinkText}>Ver ↗</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

function SectionBody({
  state,
  provider,
}: {
  state: SectionState
  provider: string
}): React.ReactElement | null {
  if (state.loading) return <ActivityIndicator color={colors.primary} />
  if (state.error) return <Text style={styles.note}>{state.error}</Text>
  if (state.data && !state.data.configured) {
    return (
      <Text style={styles.note}>
        Búsqueda real no configurada — agrega la API key de {provider}.
      </Text>
    )
  }
  if (state.data?.error)
    return <Text style={styles.note}>{state.data.error}</Text>
  if (state.data && state.data.results.length === 0) {
    return <Text style={styles.note}>Sin resultados.</Text>
  }
  if (state.data) {
    return (
      <View style={styles.results}>
        {state.data.results.map((r) => (
          <ResultRow key={r.id} result={r} />
        ))}
      </View>
    )
  }
  return null
}

export function RealSearch({
  destino,
  fechaInicio,
  fechaFin,
  personas,
}: Props): React.ReactElement {
  const [hotels, setHotels] = useState<SectionState>(initial)
  const [activities, setActivities] = useState<SectionState>(initial)
  const [flights, setFlights] = useState<SectionState>(initial)
  const [iataOrigin, setIataOrigin] = useState('')
  const [iataDest, setIataDest] = useState('')

  const run = useCallback(
    async (
      fetcher: () => Promise<SearchResponse>,
      set: React.Dispatch<React.SetStateAction<SectionState>>
    ) => {
      set({ loading: true, data: null, error: null })
      try {
        const data = await fetcher()
        set({ loading: false, data, error: null })
      } catch (err) {
        set({
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
    void run(
      () => searchHotels(destino, fechaInicio, fechaFin, personas),
      setHotels
    )
    void run(() => searchActivities(destino, fechaInicio), setActivities)
  }, [destino, fechaInicio, fechaFin, personas, run])

  const onFlightSearch = useCallback(() => {
    const origin = iataOrigin.trim().toUpperCase()
    const dest = iataDest.trim().toUpperCase()
    if (origin.length !== 3 || dest.length !== 3) return
    void run(
      () => searchFlights(origin, dest, fechaInicio, personas),
      setFlights
    )
  }, [iataOrigin, iataDest, fechaInicio, personas, run])

  const flightsValid =
    iataOrigin.trim().length === 3 && iataDest.trim().length === 3

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Búsqueda en tiempo real</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hoteles</Text>
        <SectionBody state={hotels} provider="Booking" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actividades</Text>
        <SectionBody state={activities} provider="Viator" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vuelos</Text>
        <View style={styles.flightForm}>
          <TextInput
            value={iataOrigin}
            onChangeText={(t) => setIataOrigin(t.toUpperCase())}
            maxLength={3}
            placeholder="Origen"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            style={styles.iataInput}
          />
          <TextInput
            value={iataDest}
            onChangeText={(t) => setIataDest(t.toUpperCase())}
            maxLength={3}
            placeholder="Destino"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            style={styles.iataInput}
          />
          <Button
            title="Buscar"
            size="sm"
            variant="secondary"
            disabled={!flightsValid}
            loading={flights.loading}
            onPress={onFlightSearch}
            style={styles.flightBtn}
          />
        </View>
        <Text style={styles.hint}>Usa códigos IATA (ej. MAD, JFK)</Text>
        <SectionBody state={flights} provider="Amadeus" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  heading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  note: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  results: { gap: 8 },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: 10,
    gap: 10,
  },
  resultMain: { flex: 1 },
  resultTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  resultSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  resultProvider: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  resultRight: { alignItems: 'flex-end', gap: 4 },
  resultPrice: { fontSize: 13, fontWeight: '700', color: colors.text },
  resultLink: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resultLinkText: { fontSize: 12, color: colors.text, fontWeight: '500' },
  flightForm: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iataInput: {
    width: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    textTransform: 'uppercase',
  },
  flightBtn: { flex: 1 },
  hint: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 6,
    marginBottom: 8,
  },
})
