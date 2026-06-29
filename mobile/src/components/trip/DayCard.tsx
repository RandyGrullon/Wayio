import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors, radius } from '../../theme'
import { formatCurrency } from '../../lib/utils/format'
import type { PlanningActivity, PlanningDay } from '../../types/planning'

const ESTADO_COLOR: Record<string, string> = {
  pendiente: colors.textMuted,
  en_curso: colors.primary,
  completada: colors.green,
  perdida: colors.red,
  recuperada: colors.amber,
}

function ActivityRow({
  activity,
  onMarkLost,
}: {
  activity: PlanningActivity
  onMarkLost?: (a: PlanningActivity) => void
}): React.ReactElement {
  const color = ESTADO_COLOR[activity.estado] ?? colors.textMuted
  const hasCoords = activity.lat !== 0 || activity.lng !== 0
  const lost = activity.estado === 'perdida'

  return (
    <View style={styles.actRow}>
      {/* Time rail */}
      <View style={styles.timeCol}>
        <Text style={styles.time}>{activity.horaInicio}</Text>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.timeEnd}>{activity.horaFin}</Text>
      </View>

      {/* Name + address + minimal actions */}
      <View style={styles.actBody}>
        <Text style={styles.actName} numberOfLines={1}>
          {activity.nombre}
        </Text>
        {activity.direccion ? (
          <Text style={styles.actAddr} numberOfLines={1}>
            {activity.direccion}
          </Text>
        ) : null}
        <View style={styles.actActions}>
          {hasCoords ? (
            <TouchableOpacity
              onPress={() =>
                void Linking.openURL(
                  `https://maps.google.com/?daddr=${activity.lat},${activity.lng}`
                )
              }
            >
              <Text style={styles.navLink}>📍 Llegar</Text>
            </TouchableOpacity>
          ) : null}
          {onMarkLost && !lost ? (
            <TouchableOpacity onPress={() => onMarkLost(activity)} hitSlop={6}>
              <Text style={styles.lostBtnText}>La perdí</Text>
            </TouchableOpacity>
          ) : null}
          {lost ? <Text style={styles.lost}>Perdida</Text> : null}
        </View>
      </View>

      {/* Type + price */}
      <View style={styles.actRight}>
        <Text style={styles.tipo}>{activity.tipo}</Text>
        {activity.precioEstimado > 0 ? (
          <Text style={styles.price}>
            {formatCurrency(activity.precioEstimado)}
          </Text>
        ) : null}
        {activity.reservaRequerida ? (
          <Text style={styles.reserva}>Reserva</Text>
        ) : null}
      </View>
    </View>
  )
}

export function DayCard({
  day,
  onMarkLost,
}: {
  day: PlanningDay
  onMarkLost?: (a: PlanningActivity) => void
}): React.ReactElement {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title}>
            Día {day.numero}: {day.titulo}
          </Text>
          <Text style={styles.city}>{day.ciudad}</Text>
        </View>
        <Text style={styles.budget}>{formatCurrency(day.presupuestoDia)}</Text>
      </View>
      <View>
        {day.actividades.map((a) => (
          <ActivityRow
            key={a.id}
            activity={a}
            {...(onMarkLost ? { onMarkLost } : {})}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  flex: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  city: { fontSize: 12, color: colors.textFaint, marginTop: 1 },
  budget: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  actRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  timeCol: { alignItems: 'center', width: 48 },
  time: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  timeEnd: { fontSize: 11, color: colors.textFaint, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  actBody: { flex: 1, paddingHorizontal: 8 },
  actName: { fontSize: 14, fontWeight: '600', color: colors.text },
  actAddr: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  actActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
  },
  navLink: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  actRight: { alignItems: 'flex-end', gap: 3 },
  tipo: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  price: { fontSize: 13, color: colors.text, fontWeight: '700' },
  reserva: { fontSize: 10, color: colors.amber, fontWeight: '600' },
  lost: { fontSize: 11, color: colors.red, fontWeight: '700' },
  lostBtnText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
})
