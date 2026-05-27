import { useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { findRescheduleOptions } from '../lib/scheduling/reschedule'
import type { Activity } from '../types/activity'
import type { Day } from '../types/trip'
import type { RescheduleOption } from '../types/alert'

interface Props {
  actividadPerdida: Activity
  itinerarioCompleto: Day[]
  onReschedule: (option: RescheduleOption) => void
  onClose: () => void
}

export function ReschedulePanel({
  actividadPerdida,
  itinerarioCompleto,
  onReschedule,
  onClose,
}: Props): React.ReactElement {
  const [opciones, setOpciones] = useState<RescheduleOption[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [guardada, setGuardada] = useState(false)

  const buscar = useCallback(async () => {
    setCargando(true)
    const result = await findRescheduleOptions(
      actividadPerdida,
      itinerarioCompleto
    )
    setCargando(false)
    setOpciones(result)
    if (result.length === 0) setGuardada(true)
  }, [actividadPerdida, itinerarioCompleto])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📅 Reagendar actividad</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.actividadNombre}>{actividadPerdida.nombre}</Text>
      <Text style={styles.actividadInfo}>
        {actividadPerdida.duracionMinutos} min ·{' '}
        {actividadPerdida.precio !== undefined
          ? `$${actividadPerdida.precio}`
          : 'Gratis'}
      </Text>

      {opciones === null && !cargando && (
        <TouchableOpacity
          style={styles.buscarBtn}
          onPress={() => void buscar()}
        >
          <Text style={styles.buscarBtnText}>Buscar huecos disponibles</Text>
        </TouchableOpacity>
      )}

      {cargando && (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loadingText}>Buscando...</Text>
        </View>
      )}

      {guardada && (
        <View style={styles.saved}>
          <Text style={styles.savedText}>
            No hay espacio en los próximos días. La actividad fue guardada en
            pendientes para tu próximo viaje.
          </Text>
        </View>
      )}

      {opciones !== null && opciones.length > 0 && (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {opciones.map((op, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.optionCard,
                op.esOptima && styles.optionCardOptima,
              ]}
              onPress={() => onReschedule(op)}
            >
              <View style={styles.optionHeader}>
                <Text style={styles.optionDia}>Día {op.dia}</Text>
                {op.esOptima && (
                  <View style={styles.optimalBadge}>
                    <Text style={styles.optimalText}>✨ Óptimo</Text>
                  </View>
                )}
              </View>
              <Text style={styles.optionDesc}>{op.descripcion}</Text>
              <Text style={styles.optionImpacto}>
                +{op.impactoMinutos} min de desvío
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  close: { fontSize: 18, color: '#6B7280', padding: 4 },
  actividadNombre: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E3A5F',
    marginBottom: 4,
  },
  actividadInfo: { fontSize: 13, color: '#6B7280', marginBottom: 20 },
  buscarBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buscarBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  loadingText: { fontSize: 14, color: '#6B7280' },
  saved: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
  },
  savedText: { fontSize: 14, color: '#15803D', lineHeight: 20 },
  list: { marginTop: 8 },
  optionCard: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  optionCardOptima: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionDia: { fontSize: 15, fontWeight: '700', color: '#111827' },
  optimalBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  optimalText: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
  optionDesc: { fontSize: 13, color: '#4B5563', marginBottom: 4 },
  optionImpacto: { fontSize: 12, color: '#9CA3AF' },
})
