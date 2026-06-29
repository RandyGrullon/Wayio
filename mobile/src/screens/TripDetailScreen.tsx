import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native'
import { ScreenHeader } from '../components/ui/ScreenHeader'
import { DayCard } from '../components/trip/DayCard'
import { EditableDays } from '../components/trip/EditableDays'
import { AdjustChat } from '../components/trip/AdjustChat'
import { RealSearch } from '../components/trip/RealSearch'
import { TripEssentials } from '../components/trip/TripEssentials'
import { Button } from '../components/ui/Button'
import { useNavigation } from '../navigation/NavigationContext'
import { useAuth } from '../context/AuthContext'
import { getTrip, updateTrip } from '../lib/trips/repository'
import { rescheduleActivity, validateSchedule } from '../lib/api/backend'
import { config } from '../config'
import { colors, radius } from '../theme'
import type {
  Conflict,
  PlanningActivity,
  PlanningDay,
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
  const [editing, setEditing] = useState(false)
  const [editDias, setEditDias] = useState<PlanningDay[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
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

  const handleAdjusted = useCallback(
    (updated: PlanningTrip) => {
      setTrip(updated)
      persist(updated, pendientes)
    },
    [persist, pendientes]
  )

  const startEditing = useCallback(() => {
    if (!trip) return
    setEditDias(trip.dias)
    setEditing(true)
  }, [trip])

  const saveEditing = useCallback(() => {
    if (!trip) return
    const next: PlanningTrip = { ...trip, dias: editDias }
    setTrip(next)
    persist(next, pendientes)
    setEditing(false)
  }, [trip, editDias, persist, pendientes])

  // Public read-only link (mirror of the web "Compartir vista" / viaje-compartido).
  const handleSharePublic = useCallback(() => {
    if (!trip) return
    const url = config.webUrl
      ? `${config.webUrl}/viaje-compartido/${tripId}`
      : `wayio://viaje-compartido/${tripId}`
    void Share.share({
      message: `Mira mi viaje a ${trip.destino} en Wayio: ${url}`,
    })
  }, [trip, tripId])

  // Collaborative group-invite link (mirror of the web "Compartir grupo").
  const handleShareGroup = useCallback(() => {
    if (!grupoLink) return
    const url = config.webUrl
      ? `${config.webUrl}/group/${grupoLink}`
      : `wayio://group/${grupoLink}`
    void Share.share({ message: `Únete a mi viaje en Wayio: ${url}` })
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
        {/* Primary actions: live mode + edit, the rest behind "Más" */}
        <View style={styles.actions}>
          <Button
            title="📍 Modo en vivo (GPS)"
            onPress={() => navigate({ name: 'live', trip })}
            style={styles.actionBtn}
          />
          {!editing ? (
            <View style={styles.actionRow}>
              <Button
                title="✏️ Editar"
                variant="secondary"
                onPress={startEditing}
                style={styles.half}
              />
              <Button
                title="··· Más"
                variant="secondary"
                onPress={() => setMenuOpen(true)}
                style={styles.half}
              />
            </View>
          ) : null}
        </View>

        {/* Completa tu viaje: vuelo incluido + add-ons inteligentes */}
        <TripEssentials trip={trip} />

        {trip.resumenViaje ? (
          <Text style={styles.summary}>{trip.resumenViaje}</Text>
        ) : null}

        {/* AI itinerary adjustments ("hazlo más barato"…) */}
        <AdjustChat trip={trip} onAdjusted={handleAdjusted} />

        {/* Real-time search (hotels / activities / flights) */}
        <RealSearch
          destino={trip.destino}
          fechaInicio={trip.fechaInicio}
          fechaFin={trip.fechaFin}
          personas={trip.personas}
        />

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
        {editing ? (
          <View style={styles.section}>
            <View style={styles.editBar}>
              <Text style={styles.editHint}>
                Editando — mueve, edita, borra o añade actividades.
              </Text>
              <View style={styles.editActions}>
                <Button
                  title="Cancelar"
                  variant="secondary"
                  size="sm"
                  onPress={() => setEditing(false)}
                  style={styles.half}
                />
                <Button
                  title="Guardar cambios"
                  size="sm"
                  onPress={saveEditing}
                  style={styles.half}
                />
              </View>
            </View>
            <EditableDays dias={editDias} onChange={setEditDias} />
          </View>
        ) : (
          <View style={styles.section}>
            {trip.dias.map((d) => (
              <DayCard key={d.numero} day={d} onMarkLost={handleMarkLost} />
            ))}
          </View>
        )}

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

      {/* "Más" action sheet */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <SheetItem
              label="👥 Sala grupal"
              onPress={() => {
                setMenuOpen(false)
                navigate({ name: 'group', trip, tripId })
              }}
            />
            <SheetItem
              label="🔗 Compartir vista pública"
              onPress={() => {
                setMenuOpen(false)
                handleSharePublic()
              }}
            />
            {grupoLink ? (
              <SheetItem
                label="✉️ Invitar al grupo"
                onPress={() => {
                  setMenuOpen(false)
                  handleShareGroup()
                }}
              />
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

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

function SheetItem({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}): React.ReactElement {
  return (
    <TouchableOpacity style={styles.sheetItem} onPress={onPress}>
      <Text style={styles.sheetItemText}>{label}</Text>
    </TouchableOpacity>
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
  summary: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },
  section: { marginBottom: 4 },
  editBar: { marginBottom: 12 },
  editHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  editActions: { flexDirection: 'row', gap: 10 },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 32,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  sheetItem: { paddingVertical: 14, paddingHorizontal: 8 },
  sheetItemText: { fontSize: 15, color: colors.text, fontWeight: '500' },
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
