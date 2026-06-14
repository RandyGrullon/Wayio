import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native'
import { ScreenHeader } from '../components/ui/ScreenHeader'
import { TripForm } from '../components/trip/TripForm'
import { LoadingScreen } from './LoadingScreen'
import { useNavigation } from '../navigation/NavigationContext'
import { generateTrip } from '../lib/api/backend'
import { colors } from '../theme'
import type { TripFormValues } from '../types/planning'

export function CreateTripScreen(): React.ReactElement {
  const { navigate } = useNavigation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (form: TripFormValues): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const result = await generateTrip(form)
      setLoading(false)
      navigate({ name: 'packages', result, form })
    } catch (e) {
      setLoading(false)
      setError(
        e instanceof Error ? e.message : 'No se pudo generar el itinerario'
      )
    }
  }

  if (loading) return <LoadingScreen />

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Nuevo viaje" subtitle="Planifica con IA" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.body}>
        <TripForm onSubmit={(f) => void handleSubmit(f)} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  error: {
    backgroundColor: colors.redBg,
    color: colors.red,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    fontSize: 13,
  },
})
