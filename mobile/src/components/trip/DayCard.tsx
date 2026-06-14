import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
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
  return (
    <View style={styles.actRow}>
      <View style={styles.timeCol}>
        <Text style={styles.time}>{activity.horaInicio}</Text>
        <View style={[styles.dot, { backgroundColor: color }]} />
      </View>
      <View style={styles.actBody}>
        <Text style={styles.actName}>{activity.nombre}</Text>
        {activity.descripcion ? (
          <Text style={styles.actDesc} numberOfLines={2}>
            {activity.descripcion}
          </Text>
        ) : null}
        <View style={styles.actMeta}>
          {activity.precioEstimado > 0 ? (
            <Text style={styles.price}>
              {formatCurrency(activity.precioEstimado)}
            </Text>
          ) : null}
          {activity.reservaRequerida ? (
            <Text style={styles.reserva}>Reserva</Text>
          ) : null}
          {activity.estado === 'perdida' ? (
            <Text style={styles.lost}>Perdida</Text>
          ) : null}
        </View>
      </View>
      {onMarkLost && activity.estado !== 'perdida' ? (
        <TouchableOpacity
          onPress={() => onMarkLost(activity)}
          hitSlop={8}
          style={styles.lostBtn}
        >
          <Text style={styles.lostBtnText}>La perdí</Text>
        </TouchableOpacity>
      ) : null}
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
  timeCol: { alignItems: 'center', width: 52 },
  time: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  actBody: { flex: 1, paddingHorizontal: 8 },
  actName: { fontSize: 14, fontWeight: '600', color: colors.text },
  actDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },
  actMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  price: { fontSize: 12, color: colors.text, fontWeight: '600' },
  reserva: { fontSize: 11, color: colors.amber, fontWeight: '600' },
  lost: { fontSize: 11, color: colors.red, fontWeight: '700' },
  lostBtn: { alignSelf: 'center' },
  lostBtnText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
})
