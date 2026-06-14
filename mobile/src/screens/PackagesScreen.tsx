import { useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native'
import { ScreenHeader } from '../components/ui/ScreenHeader'
import { PackageCard } from '../components/trip/PackageCard'
import { WeatherStrip } from '../components/trip/WeatherStrip'
import { useNavigation } from '../navigation/NavigationContext'
import { createTrip } from '../lib/trips/repository'
import { colors } from '../theme'
import type { GenerateResult, Paquete, TripFormValues } from '../types/planning'

const ORDER: Paquete[] = ['basico', 'confort', 'premium']

export function PackagesScreen({
  result,
  form,
}: {
  result: GenerateResult
  form: TripFormValues
}): React.ReactElement {
  const { navigate } = useNavigation()
  const [saving, setSaving] = useState<Paquete | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = async (paquete: Paquete): Promise<void> => {
    setSaving(paquete)
    setError(null)
    try {
      const trip = { ...result[paquete], paquete }
      const row = await createTrip(trip)
      setSaving(null)
      navigate({ name: 'trip', tripId: row.id })
    } catch (e) {
      setSaving(null)
      setError(e instanceof Error ? e.message : 'No se pudo guardar el viaje')
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Elige tu paquete"
        subtitle={`${result.basico.destino} · ${form.fechaInicio} → ${form.fechaFin}`}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {result.weather ? <WeatherStrip weather={result.weather} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {ORDER.map((p) => (
          <PackageCard
            key={p}
            paquete={p}
            trip={result[p]}
            moneda={form.moneda}
            selected={saving === p}
            onSelect={() => void handleSelect(p)}
          />
        ))}
        {saving ? (
          <Text style={styles.saving}>Guardando tu viaje...</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20 },
  error: {
    backgroundColor: colors.redBg,
    color: colors.red,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 13,
  },
  saving: { textAlign: 'center', color: colors.textMuted, marginTop: 8 },
})
