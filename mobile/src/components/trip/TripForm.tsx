import { useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { colors, radius } from '../../theme'
import type { Moneda, Paquete, TripFormValues } from '../../types/planning'

type Tipo = TripFormValues['tipo']

const TIPOS: { value: Tipo; label: string }[] = [
  { value: 'aventura', label: 'Aventura' },
  { value: 'relax', label: 'Relax' },
  { value: 'cultura', label: 'Cultura' },
  { value: 'familia', label: 'Familia' },
  { value: 'crucero', label: 'Crucero' },
  { value: 'romantico', label: 'Romántico' },
  { value: 'gastronomia', label: 'Gastronomía' },
]
const MONEDAS: Moneda[] = ['USD', 'EUR', 'DOP']
const PAQUETES: { value: Paquete; label: string }[] = [
  { value: 'basico', label: 'Básico' },
  { value: 'confort', label: 'Confort' },
  { value: 'premium', label: 'Premium' },
]

interface Props {
  initial?: Partial<TripFormValues>
  onSubmit: (form: TripFormValues) => void
}

export function TripForm({ initial, onSubmit }: Props): React.ReactElement {
  const [destino, setDestino] = useState(initial?.destino ?? '')
  const [destinoSorpresa, setDestinoSorpresa] = useState(
    initial?.destinoSorpresa ?? false
  )
  const [origen, setOrigen] = useState(initial?.origen ?? '')
  const [personas, setPersonas] = useState(String(initial?.personas ?? 2))
  const [fechaInicio, setFechaInicio] = useState(initial?.fechaInicio ?? '')
  const [fechaFin, setFechaFin] = useState(initial?.fechaFin ?? '')
  const [presupuesto, setPresupuesto] = useState(
    String(initial?.presupuesto ?? 2000)
  )
  const [moneda, setMoneda] = useState<Moneda>(initial?.moneda ?? 'USD')
  const [tipo, setTipo] = useState<Tipo>(initial?.tipo ?? 'aventura')
  const [paquete, setPaquete] = useState<Paquete>(initial?.paquete ?? 'confort')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (): void => {
    const personasNum = parseInt(personas, 10)
    const presupuestoNum = parseFloat(presupuesto)

    if (!destinoSorpresa && destino.trim().length < 2)
      return setError('Ingresa un destino válido')
    if (origen.trim().length < 2) return setError('Ingresa tu ciudad de origen')
    if (!fechaInicio || !fechaFin)
      return setError('Ingresa las fechas de inicio y fin')
    if (isNaN(personasNum) || personasNum < 1 || personasNum > 20)
      return setError('Número de personas inválido (1–20)')
    if (isNaN(presupuestoNum) || presupuestoNum < 100)
      return setError('Presupuesto mínimo: 100')

    setError(null)
    onSubmit({
      destino: destinoSorpresa ? 'Sorpréndeme' : destino.trim(),
      destinoSorpresa,
      origen: origen.trim(),
      personas: personasNum,
      fechaInicio,
      fechaFin,
      presupuesto: presupuestoNum,
      moneda,
      tipo,
      paquete,
    })
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <TouchableOpacity
        style={styles.surpriseRow}
        onPress={() => setDestinoSorpresa((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, destinoSorpresa && styles.checkboxOn]}>
          {destinoSorpresa ? <Text style={styles.check}>✓</Text> : null}
        </View>
        <Text style={styles.surpriseText}>
          Destino sorpresa (deja que la IA elija)
        </Text>
      </TouchableOpacity>

      {!destinoSorpresa ? (
        <Input
          label="Destino"
          placeholder="Ej: Tokio, Japón"
          value={destino}
          onChangeText={setDestino}
        />
      ) : null}

      <Input
        label="Ciudad de origen"
        placeholder="Ej: Santo Domingo"
        value={origen}
        onChangeText={setOrigen}
      />

      <View style={styles.row}>
        <View style={styles.col}>
          <Input
            label="Personas"
            placeholder="2"
            value={personas}
            onChangeText={setPersonas}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.col}>
          <Input
            label="Presupuesto"
            placeholder="2000"
            value={presupuesto}
            onChangeText={setPresupuesto}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.col}>
          <Input
            label="Fecha inicio"
            placeholder="2026-07-01"
            value={fechaInicio}
            onChangeText={setFechaInicio}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.col}>
          <Input
            label="Fecha fin"
            placeholder="2026-07-07"
            value={fechaFin}
            onChangeText={setFechaFin}
            autoCapitalize="none"
          />
        </View>
      </View>

      <Text style={styles.label}>Moneda</Text>
      <Chips
        options={MONEDAS.map((m) => ({ value: m, label: m }))}
        selected={moneda}
        onSelect={(v) => setMoneda(v as Moneda)}
      />

      <Text style={styles.label}>Tipo de viaje</Text>
      <Chips
        options={TIPOS}
        selected={tipo}
        onSelect={(v) => setTipo(v as Tipo)}
      />

      <Text style={styles.label}>Paquete</Text>
      <Chips
        options={PAQUETES}
        selected={paquete}
        onSelect={(v) => setPaquete(v as Paquete)}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title="Planificar mi viaje"
        onPress={handleSubmit}
        size="lg"
        style={styles.submit}
      />
      <View style={styles.bottom} />
    </ScrollView>
  )
}

function Chips({
  options,
  selected,
  onSelect,
}: {
  options: { value: string; label: string }[]
  selected: string
  onSelect: (value: string) => void
}): React.ReactElement {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.value === selected
        return (
          <TouchableOpacity
            key={o.value}
            onPress={() => onSelect(o.value)}
            activeOpacity={0.8}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
    marginTop: 4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  surpriseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  check: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  surpriseText: { fontSize: 14, color: colors.text, flex: 1 },
  error: {
    backgroundColor: colors.redBg,
    color: colors.red,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 13,
  },
  submit: { marginTop: 8 },
  bottom: { height: 40 },
})
