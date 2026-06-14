import { View, Text, StyleSheet } from 'react-native'
import type { ActivityEvaluation } from '../types/activity'

const STATUS_COLORS: Record<ActivityEvaluation['estado'], string> = {
  pendiente: '#6B7280',
  en_curso: '#2563EB',
  completada: '#16A34A',
  perdida: '#DC2626',
}

const STATUS_LABELS: Record<ActivityEvaluation['estado'], string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  completada: 'Completada',
  perdida: 'Perdida',
}

interface Props {
  activity: ActivityEvaluation
  index: number
}

export function ActivityCard({ activity, index }: Props): React.ReactElement {
  const color = STATUS_COLORS[activity.estado]

  return (
    <View style={styles.card}>
      <View style={[styles.indexBadge, { backgroundColor: color }]}>
        <Text style={styles.indexText}>{index + 1}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.nombre}>{activity.nombre}</Text>
        <Text style={styles.descripcion} numberOfLines={2}>
          {activity.descripcion}
        </Text>
        <View style={styles.footer}>
          <View style={[styles.statusBadge, { backgroundColor: `${color}20` }]}>
            <Text style={[styles.statusText, { color }]}>
              {STATUS_LABELS[activity.estado]}
            </Text>
          </View>
          {activity.precio !== undefined && (
            <Text style={styles.precio}>${activity.precio}</Text>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  indexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  indexText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  nombre: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  descripcion: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  precio: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
})
