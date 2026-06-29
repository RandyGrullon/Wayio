import { useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { adjustTrip } from '../../lib/api/backend'
import { colors, radius } from '../../theme'
import type { PlanningTrip } from '../../types/planning'

interface Props {
  trip: PlanningTrip
  onAdjusted: (trip: PlanningTrip) => void
}

const SUGERENCIAS = [
  'Hazlo más relajado',
  'Añade un día de playa',
  'Más barato',
  'Más actividades culturales',
  'Menos traslados',
] as const

/** Mobile counterpart of the web `AdjustChat`: tweak an itinerary with the AI. */
export function AdjustChat({ trip, onAdjusted }: Props): React.ReactElement {
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async (instruccion: string): Promise<void> => {
    const limpio = instruccion.trim()
    if (!limpio || loading) return
    setLoading(true)
    setError(null)
    try {
      const updated = await adjustTrip(trip, limpio)
      onAdjusted(updated)
      setTexto('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>✨ Ajusta tu viaje con IA</Text>

      <View style={styles.chips}>
        {SUGERENCIAS.map((s) => (
          <TouchableOpacity
            key={s}
            disabled={loading}
            onPress={() => void enviar(s)}
            style={[styles.chip, loading && styles.chipDisabled]}
          >
            <Text style={styles.chipText}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          editable={!loading}
          placeholder="Ej.: añade un mercado local el día 2"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          onSubmitEditing={() => void enviar(texto)}
          returnKeyType="send"
        />
        <TouchableOpacity
          disabled={loading || !texto.trim()}
          onPress={() => void enviar(texto)}
          style={[
            styles.sendBtn,
            (loading || !texto.trim()) && styles.sendBtnDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.sendText}>Enviar</Text>
          )}
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <Text style={styles.note}>
          La IA está reescribiendo tu itinerario. Puede tardar unos segundos.
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  heading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipDisabled: { opacity: 0.5 },
  chipText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  error: { fontSize: 12, color: colors.red, marginTop: 8 },
  note: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
})
