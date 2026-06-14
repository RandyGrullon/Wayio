import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native'
import { ScreenHeader } from '../components/ui/ScreenHeader'
import { DayCard } from '../components/trip/DayCard'
import { Button } from '../components/ui/Button'
import { useNavigation } from '../navigation/NavigationContext'
import { useAuth } from '../context/AuthContext'
import { getTrip, updateTrip } from '../lib/trips/repository'
import { rescheduleActivity, validateSchedule } from '../lib/api/backend'
import { config } from '../config'
import { colors, radius } from '../theme'
import { formatCurrency } from '../lib/utils/format'
import type {
  Conflict,
  PlanningActivity,
  PlanningTrip,
} from '../types/planning'

export function TripDetailScreen({
  tripId,
}: {
  tripId: string
}): React.ReactElement {
  const { navigate } = useNavigation()
  const { tier } = useAuth()
  const [trip, setTrip] = useState<PlanningTrip | null>(null)
  const [grupoLink, setGrupoLink] = useState<string | null>(null)
  const [pendientes, setPendientes] = useState<PlanningActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<Conflict[]>([])

  const [target, setTarget] = useState<PlanningActivity | null>(null)
  const [suggestion, setSuggestion] = useState<PlanningActivity | null>(null)
  const [rescheduling, setRescheduling] = useState(false)

  const load = useCallback(async () => {
    try {
      const row = await getTrip(tripId)
      if (!row) {
        setError('Viaje no encontrado')
        return
      }
      setTrip(row.data)
      setGrupoLink(row.grupo_link)
      setPendientes(row.actividades_pendientes ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando el viaje')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [load])

  // Validate schedule for conflicts (best-effort, requires backend)
  useEffect(() => {
    if (!trip) return
    void validateSchedule(trip.dias).then(setConflicts)
  }, [trip])

  const persist = useCallback(
    (next: PlanningTrip, nextPend: PlanningActivity[]) => {
      void updateTrip(tripId, {
        data: next,
        actividades_pendientes: nextPend,
      })
    },
    [tripId]
  )

  const handleMarkLost = useCallback(
    (activity: PlanningActivity) => {
      if (!trip) return
      const next: PlanningTrip = {
        ...trip,
        dias: trip.dias.map((d) => ({
          ...d,
          actividades: d.actividades.map((a) =>
            a.id === activity.id
              ? { ...a, estado: 'perdida', esPerdida: true }
              : a
          ),
        })),
      }
      const nextPend = [...pendientes, activity]
      setTrip(next)
      setPendientes(nextPend)
      persist(next, nextPend)

      if (tier === 'free') {
        navigate({ name: 'paywall' })
        return
      }
      setTarget(activity)
      setSuggestion(null)
    },
    [trip, pendientes, persist, tier, navigate]
  )

  const handleFindSlot = useCallback(async () => {
    if (!target) return
    setRescheduling(true)
    const updated = await rescheduleActivity(
      target.id,
      tripId,
      'El usuario la perdió o no pudo asistir'
    )
    setSuggestion(updated)
    setRescheduling(false)
  }, [target, tripId])

  const handleAccept = useCallback(() => {
    if (!trip || !target || !suggestion) return
    const next: PlanningTrip = {
      ...trip,
      dias: trip.dias.map((d) => ({
        ...d,
        actividades: d.actividades.map((a) =>
          a.id === target.id
            ? {
                ...suggestion,
                id: target.id,
                estado: 'pendiente',
                esPerdida: false,
              }
            : a
        ),
      })),
    }
    const nextPend = pendientes.filter((a) => a.id !== target.id)
    setTrip(next)
    setPendientes(nextPend)
    persist(next, nextPend)
    setTarget(null)
    setSuggestion(null)
  }, [trip, target, suggestion, pendientes, persist])

  const handleShare = useCallback(() => {
    if (!grupoLink) return
    const url = config.webUrl
      ? `${config.webUrl}/group/${grupoLink}`
      : `wayio://group/${grupoLink}`
    void Share.share({
      message: `Únete a mi viaje en Wayio: ${url}`,
    })
  }, [grupoLink])

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (error || !trip) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Viaje" />
        <View style={styles.center}>
          <Text style={styles.error}>{error ?? 'Viaje no encontrado'}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title={trip.destino}
        subtitle={`${trip.personas} pers · ${trip.fechaInicio} → ${trip.fechaFin}`}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Primary actions */}
        <View style={styles.actions}>
          <Button
            title="📍 Modo en vivo (GPS)"
            onPress={() => navigate({ name: 'live', trip })}
            style={styles.actionBtn}
          />
          <View style={styles.actionRow}>
            <Button
              title="👥 Sala grupal"
              variant="secondary"
              onPress={() => navigate({ name: 'group', trip, tripId })}
              style={styles.half}
            />
            <Button
              title="Compartir"
              variant="secondary"
              onPress={handleShare}
              style={styles.half}
            />
          </View>
        </View>

        {/* Budget */}
        <View style={styles.budgetRow}>
          <View style={styles.budgetBox}>
            <Text style={styles.budgetLabel}>Total</Text>
            <Text style={styles.budgetValue}>
              {formatCurrency(trip.presupuestoTotal)}
            </Text>
          </View>
          <View style={styles.budgetBox}>
            <Text style={styles.budgetLabel}>Por persona</Text>
            <Text style={styles.budgetValue}>
              {formatCurrency(trip.presupuestoPorPersona)}
            </Text>
          </View>
        </View>

        {trip.resumenViaje ? (
          <Text style={styles.summary}>{trip.resumenViaje}</Text>
        ) : null}

        {/* Conflicts */}
        {conflicts.length > 0 ? (
          <View style={styles.section}>
            {conflicts.map((c) => (
              <View
                key={c.id}
                style={[styles.conflict, severityStyle(c.severidad)]}
              >
                <Text style={styles.conflictTitle}>
                  {c.severidad.toUpperCase()} · {c.titulo}
                </Text>
                <Text style={styles.conflictDesc}>{c.descripcion}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Warnings */}
        {trip.advertencias.length > 0 ? (
          <View style={[styles.note, styles.warn]}>
            <Text style={styles.noteTitle}>Advertencias</Text>
            {trip.advertencias.map((a, i) => (
              <Text key={i} style={styles.noteItem}>
                • {a}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Pendientes */}
        {pendientes.length > 0 ? (
          <View style={[styles.note, styles.pend]}>
            <Text style={styles.noteTitle}>Actividades pendientes</Text>
            {pendientes.map((a) => (
              <Text key={a.id} style={styles.noteItem}>
                • {a.nombre}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Days */}
        <View style={styles.section}>
          {trip.dias.map((d) => (
            <DayCard key={d.numero} day={d} onMarkLost={handleMarkLost} />
          ))}
        </View>

        {/* Tips */}
        {trip.consejos.length > 0 ? (
          <View style={[styles.note, styles.tip]}>
            <Text style={styles.noteTitle}>Consejos</Text>
            {trip.consejos.map((c, i) => (
              <Text key={i} style={styles.noteItem}>
                • {c}
              </Text>
            ))}
          </View>
        ) : null}
        <View style={styles.bottom} />
      </ScrollView>

      {/* Reschedule modal */}
      <Modal
        visible={target !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Actividad perdida: {target?.nombre}
            </Text>
            {suggestion ? (
              <>
                <Text style={styles.modalText}>
                  La IA sugiere reagendar para:{'\n'}
                  <Text style={styles.modalStrong}>
                    {suggestion.horaInicio} – {suggestion.horaFin}
                  </Text>
                </Text>
                <View style={styles.modalRow}>
                  <Button
                    title="Aceptar"
                    onPress={handleAccept}
                    style={styles.modalBtn}
                  />
                  <Button
                    title="Descartar"
                    variant="secondary"
                    onPress={() => {
                      setTarget(null)
                      setSuggestion(null)
                    }}
                    style={styles.modalBtn}
                  />
                </View>
              </>
            ) : (
              <View style={styles.modalRow}>
                <Button
                  title={rescheduling ? 'Buscando...' : 'Buscar nueva hora'}
                  onPress={() => void handleFindSlot()}
                  loading={rescheduling}
                  style={styles.modalBtn}
                />
                <Button
                  title="Dejar perdida"
                  variant="secondary"
                  onPress={() => setTarget(null)}
                  style={styles.modalBtn}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function severityStyle(sev: Conflict['severidad']): {
  backgroundColor: string
} {
  switch (sev) {
    case 'critico':
      return { backgroundColor: colors.redBg }
    case 'advertencia':
      return { backgroundColor: colors.amberBg }
    case 'sugerencia':
      return { backgroundColor: colors.primaryLight }
    default:
      return { backgroundColor: colors.bg }
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  error: { color: colors.red, fontSize: 15 },
  scroll: { padding: 20 },
  actions: { marginBottom: 16 },
  actionBtn: { marginBottom: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  budgetRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  budgetBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
  },
  budgetLabel: { fontSize: 12, color: colors.textMuted },
  budgetValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  summary: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },
  section: { marginBottom: 4 },
  conflict: { borderRadius: radius.md, padding: 12, marginBottom: 8 },
  conflictTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  conflictDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  note: { borderRadius: radius.md, padding: 14, marginBottom: 14 },
  warn: { backgroundColor: colors.amberBg },
  tip: { backgroundColor: colors.primaryLight },
  pend: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  noteItem: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  bottom: { height: 30 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 21,
  },
  modalStrong: { fontWeight: '700', color: colors.text },
  modalRow: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1 },
})
