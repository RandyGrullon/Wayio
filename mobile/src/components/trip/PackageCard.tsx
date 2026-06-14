import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors, radius } from '../../theme'
import { formatCurrency } from '../../lib/utils/format'
import type { Paquete, PlanningTrip } from '../../types/planning'

const META: Record<Paquete, { label: string; desc: string }> = {
  basico: { label: 'Básico', desc: 'Lo esencial, bajo presupuesto' },
  confort: { label: 'Confort', desc: 'El equilibrio ideal' },
  premium: { label: 'Premium', desc: 'La mejor experiencia' },
}

export function PackageCard({
  paquete,
  trip,
  moneda,
  selected,
  onSelect,
}: {
  paquete: Paquete
  trip: PlanningTrip
  moneda: string
  selected: boolean
  onSelect: () => void
}): React.ReactElement {
  const m = META[paquete]
  const totalActs = trip.dias.reduce((n, d) => n + d.actividades.length, 0)

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onSelect}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={styles.label}>{m.label}</Text>
          <Text style={styles.desc}>{m.desc}</Text>
        </View>
        {paquete === 'confort' ? (
          <View style={styles.popular}>
            <Text style={styles.popularText}>POPULAR</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.price}>
        {formatCurrency(trip.presupuestoTotal, moneda)}
      </Text>
      <Text style={styles.perPerson}>
        {formatCurrency(trip.presupuestoPorPersona, moneda)} / persona
      </Text>

      <View style={styles.statsRow}>
        <Text style={styles.stat}>{trip.dias.length} días</Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.stat}>{totalActs} actividades</Text>
      </View>

      <Text style={styles.summary} numberOfLines={3}>
        {trip.resumenViaje}
      </Text>

      <View style={[styles.selectBtn, selected && styles.selectBtnOn]}>
        <Text style={[styles.selectText, selected && styles.selectTextOn]}>
          {selected ? '✓ Seleccionado' : 'Elegir este'}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  cardSelected: { borderColor: colors.primary },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  flex: { flex: 1 },
  label: { fontSize: 18, fontWeight: '700', color: colors.text },
  desc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  popular: {
    backgroundColor: colors.indigo,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  popularText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  price: { fontSize: 26, fontWeight: '800', color: colors.text, marginTop: 10 },
  perPerson: { fontSize: 13, color: colors.textMuted },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  stat: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  dot: { marginHorizontal: 6, color: colors.textFaint },
  summary: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 10,
    lineHeight: 19,
  },
  selectBtn: {
    marginTop: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 10,
    alignItems: 'center',
  },
  selectBtnOn: { backgroundColor: colors.primary },
  selectText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  selectTextOn: { color: '#FFFFFF' },
})
